import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { LotDailySnapshotStatus } from '@prisma/client';

/** Campos canônicos mapeados para cabeçalhos da planilha. */
export type SpreadsheetCanonicalField =
  | 'block'
  | 'lotNumber'
  | 'status'
  | 'price'
  | 'area'
  | 'notes'
  | 'developmentName';

export type SpreadsheetColumnMapping = Partial<Record<SpreadsheetCanonicalField, string | null>>;

const HEADER_ALIASES: { field: SpreadsheetCanonicalField; patterns: RegExp[] }[] = [
  { field: 'developmentName', patterns: [/loteamento/i, /empreendimento/i, /condom[ií]nio/i, /development/i, /empreend/i] },
  {
    field: 'block',
    patterns: [/^quadra$/i, /^q$/i, /^block$/i, /^setor$/i, /^fra[çc][ãa]o$/i, /^quad$/i, /quadra.*nome/i],
  },
  {
    field: 'lotNumber',
    patterns: [
      /^lote$/i,
      /^lot$/i,
      /^n[ºo°]/i,
      /^unidade$/i,
      /^numero$/i,
      /^número$/i,
      /n[ºo°]?\s*lote/i,
      /lote\s*n[ºo°]?/i,
      /c[oó]d.*lote/i,
      /num.*lote/i,
    ],
  },
  { field: 'status', patterns: [/status/i, /situa[çc][ãa]o/i, /disponibilidade/i, /estoque/i] },
  { field: 'price', patterns: [/pre[çc]o/i, /valor/i, /^vlr$/i, /^venda$/i] },
  { field: 'area', patterns: [/m2/i, /m²/i, /area/i, /área/i, /metragem/i] },
  { field: 'notes', patterns: [/obs/i, /nota/i, /coment/i, /observa/i] },
];

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class SpreadsheetParsingService {
  /** Lê primeira aba (ou CSV) em matriz de strings. */
  parseToRows(buffer: Buffer, _mimetype: string, originalName: string): { rows: string[][]; sheetName: string } {
    if (!buffer?.length) throw new BadRequestException('Arquivo vazio');
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
    if (!wb.SheetNames?.length) throw new BadRequestException('Planilha sem abas');
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    const rows: string[][] = matrix.map((row) =>
      (Array.isArray(row) ? row : []).map((c) => {
        if (c == null) return '';
        if (typeof c === 'number') return String(c);
        return String(c).trim();
      }),
    );
    const cleaned = rows.filter((r) => r.some((c) => c !== ''));
    if (cleaned.length < 2) throw new BadRequestException('Planilha precisa de cabeçalho e ao menos uma linha de dados');
    return { rows: cleaned, sheetName };
  }

  /** Sugere mapeamento a partir da primeira linha (cabeçalhos). */
  inferColumnMapping(headerRow: string[]): SpreadsheetColumnMapping {
    const mapping: SpreadsheetColumnMapping = {};
    const used = new Set<number>();
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i]?.trim() ?? '';
      if (!h) continue;
      const n = normalizeHeader(h);
      for (const { field, patterns } of HEADER_ALIASES) {
        if (mapping[field]) continue;
        if (patterns.some((p) => p.test(h) || p.test(n))) {
          mapping[field] = h;
          used.add(i);
          break;
        }
      }
    }
    return mapping;
  }

  /** Aplica mapeamento: retorna objetos por linha de dados (sem cabeçalho). */
  mapDataRows(
    rows: string[][],
    headerRowIndex: number,
    mapping: SpreadsheetColumnMapping,
  ): Array<Record<SpreadsheetCanonicalField, string>> {
    const headers = rows[headerRowIndex] ?? [];
    const colByField = new Map<SpreadsheetCanonicalField, number>();
    for (const [field, headerName] of Object.entries(mapping) as [SpreadsheetCanonicalField, string | null | undefined][]) {
      if (!headerName?.trim()) continue;
      const idx = headers.findIndex((h) => h.trim() === headerName.trim());
      if (idx >= 0) colByField.set(field, idx);
    }

    const out: Array<Record<SpreadsheetCanonicalField, string>> = [];
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const line = rows[r];
      const obj = {} as Record<SpreadsheetCanonicalField, string>;
      for (const [field, colIdx] of colByField.entries()) {
        obj[field] = line[colIdx] ?? '';
      }
      out.push(obj);
    }
    return out;
  }
}

export function parseSnapshotStatusFromText(raw: string): LotDailySnapshotStatus | null {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!s) return null;
  /** Evita casar "disp" dentro de "indisponível" / "indisponivel". */
  if (/indispon/.test(s)) return null;
  if (/vend/.test(s)) return LotDailySnapshotStatus.VENDIDO;
  if (/reserv/.test(s)) return LotDailySnapshotStatus.RESERVADO;
  if (/negoci/.test(s)) return LotDailySnapshotStatus.NEGOCIACAO;
  if (/^disponivel$|^dispon[ií]vel$|^livre$|^free$|^liberad/.test(s)) {
    return LotDailySnapshotStatus.DISPONIVEL;
  }
  if (/disp|livre|free|estoque/.test(s)) return LotDailySnapshotStatus.DISPONIVEL;
  if (s === 'd' || s === 'disp' || s === 'disponivel') return LotDailySnapshotStatus.DISPONIVEL;
  if (s === 'r') return LotDailySnapshotStatus.RESERVADO;
  if (s === 'v') return LotDailySnapshotStatus.VENDIDO;
  if (s === 'n' || /^neg$/.test(s)) return LotDailySnapshotStatus.NEGOCIACAO;
  return null;
}

export function parseMoney(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const noThousands = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  const n = parseFloat(noThousands.replace(/[^\d.-]/g, ''));
  if (Number.isNaN(n)) return undefined;
  return n;
}

export function parseAreaM2(raw: string): number | undefined {
  return parseMoney(raw);
}
