import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DailyAvailabilitySourceType,
  GestoraSubmissionStatus,
  LotDailySnapshotStatus,
  Prisma,
  PropertyStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { AuditService } from '../../audit/audit.service';
import { DailyAvailabilityService } from '../daily-availability.service';
import {
  parseMoney,
  parseSnapshotStatusFromText,
  SpreadsheetColumnMapping,
  SpreadsheetParsingService,
} from './spreadsheet-parsing.service';
import { SpreadsheetValidationService } from './spreadsheet-validation.service';

function propertyStatusToSnapshot(s: PropertyStatus): LotDailySnapshotStatus {
  switch (s) {
    case PropertyStatus.VENDIDO:
      return LotDailySnapshotStatus.VENDIDO;
    case PropertyStatus.RESERVADO:
      return LotDailySnapshotStatus.RESERVADO;
    case PropertyStatus.EM_NEGOCIACAO:
      return LotDailySnapshotStatus.NEGOCIACAO;
    default:
      return LotDailySnapshotStatus.DISPONIVEL;
  }
}

function normLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export type SpreadsheetPreviewResult = {
  sheetName: string;
  headers: string[];
  rowCount: number;
  suggestedMapping: SpreadsheetColumnMapping;
  sampleRows: string[][];
};

export type SpreadsheetReconcilePreview = {
  developmentId: string;
  date: string;
  sheetName: string;
  totalRowsInFile: number;
  dataRows: number;
  /** Linhas de dados totalmente em branco (quadra e lote vazios). */
  rowsSkippedBlank: number;
  matchedFromSheet: number;
  unmatchedRows: Array<{ rowIndex: number; reason: string; block?: string; lot?: string }>;
  invalidRows: Array<{ rowIndex: number; reason: string }>;
  duplicateRowWarnings: number;
  changesVsPrevious: Array<{
    lotId: string;
    from: LotDailySnapshotStatus | null;
    to: LotDailySnapshotStatus;
    block?: string;
    lotNumber?: string;
  }>;
  snapshots: Array<{ lotId: string; status: LotDailySnapshotStatus; price?: number; notes?: string }>;
  /** Resumo para UI (primeiras linhas reconciliadas). */
  matchedSample: Array<{
    rowIndex: number;
    lotId: string;
    block: string;
    lotNumber: string;
    status: LotDailySnapshotStatus;
  }>;
};

@Injectable()
export class SpreadsheetAvailabilityImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parsing: SpreadsheetParsingService,
    private readonly validation: SpreadsheetValidationService,
    private readonly dailyAvailability: DailyAvailabilityService,
    private readonly cloudinary: CloudinaryService,
    private readonly audit: AuditService,
  ) {}

  analyze(developmentId: string, file: Express.Multer.File): SpreadsheetPreviewResult {
    const { rows, sheetName } = this.parsing.parseToRows(file.buffer, file.mimetype, file.originalname);
    this.assertDevelopment(developmentId);
    const headerRow = rows[0] ?? [];
    const suggested = this.parsing.inferColumnMapping(headerRow);
    const dataRows = Math.max(0, rows.length - 1);
    this.validation.assertDataRowLimit(rows.length);
    return {
      sheetName,
      headers: headerRow,
      rowCount: dataRows,
      suggestedMapping: suggested,
      sampleRows: rows.slice(1, 21),
    };
  }

  async preview(
    developmentId: string,
    file: Express.Multer.File,
    columnMapping: SpreadsheetColumnMapping,
    dateIso: string,
  ): Promise<SpreadsheetReconcilePreview> {
    await this.assertDevelopment(developmentId);
    this.validation.assertMappingComplete(columnMapping);
    const { rows, sheetName } = this.parsing.parseToRows(file.buffer, file.mimetype, file.originalname);
    this.validation.assertDataRowLimit(rows.length);
    return this.reconcile(developmentId, dateIso, rows, 0, columnMapping, sheetName);
  }

  async confirm(
    developmentId: string,
    userId: string,
    file: Express.Multer.File,
    columnMapping: SpreadsheetColumnMapping,
    dateIso: string,
    opts?: {
      templateId?: string;
      saveTemplate?: { name: string; gestoraLabel?: string };
      gestoraSubmissionStatus?: GestoraSubmissionStatus | null;
    },
  ) {
    const preview = await this.preview(developmentId, file, columnMapping, dateIso);
    if (preview.matchedFromSheet === 0) {
      throw new BadRequestException(
        'Nenhuma linha da planilha pôde ser associada a lotes do cadastro. Revise o mapeamento ou os dados.',
      );
    }

    const { url } = await this.cloudinary.uploadSpreadsheet(file);
    const sourceType = this.validation.resolveSourceType(file);

    let templateName: string | null = null;
    if (opts?.templateId?.trim()) {
      const tpl = await this.prisma.spreadsheetImportTemplate.findFirst({
        where: { id: opts.templateId.trim(), developmentId },
        select: { name: true },
      });
      templateName = tpl?.name ?? null;
    }

    if (opts?.saveTemplate?.name?.trim()) {
      await this.prisma.spreadsheetImportTemplate.create({
        data: {
          name: opts.saveTemplate.name.trim(),
          gestoraLabel: opts.saveTemplate.gestoraLabel?.trim() || null,
          developmentId,
          columnMapping: columnMapping as unknown as Prisma.InputJsonValue,
          createdById: userId,
        },
      });
    }

    const importMetadata = {
      mode: 'SPREADSHEET' as const,
      fileName: file.originalname,
      fileUrl: url,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      sheetName: preview.sheetName,
      templateId: opts?.templateId?.trim() || null,
      templateName,
      rowCount: preview.totalRowsInFile,
      dataRows: preview.dataRows,
      rowsSkippedBlank: preview.rowsSkippedBlank,
      matchedFromSheet: preview.matchedFromSheet,
      unmatchedCount: preview.unmatchedRows.length,
      invalidCount: preview.invalidRows.length,
      duplicateWarnings: preview.duplicateRowWarnings,
      changesCount: preview.changesVsPrevious.length,
      confirmedAt: new Date().toISOString(),
    };

    const snapOpts =
      opts?.gestoraSubmissionStatus != null
        ? { gestoraSubmissionStatus: opts.gestoraSubmissionStatus }
        : undefined;
    const result = await this.dailyAvailability.createSnapshot(
      developmentId,
      userId,
      {
        date: dateIso,
        sourceType,
        sourceFileUrl: url,
        snapshots: preview.snapshots,
        importMetadata,
      },
      snapOpts,
    );

    await this.audit.log({
      userId,
      action: 'DAILY_AVAILABILITY_SPREADSHEET_IMPORTED',
      entity: 'DailyAvailability',
      entityId: result.id,
      metadata: {
        developmentId,
        date: dateIso,
        sourceType,
        fileName: file.originalname,
        fileUrl: url,
        sheetName: preview.sheetName,
        templateId: opts?.templateId ?? null,
        templateName,
        matchedFromSheet: preview.matchedFromSheet,
        unmatchedCount: preview.unmatchedRows.length,
        invalidCount: preview.invalidRows.length,
        changesCount: preview.changesVsPrevious.length,
      },
    });

    return { result, preview };
  }

  async listTemplates(developmentId: string) {
    await this.assertDevelopment(developmentId);
    return this.prisma.spreadsheetImportTemplate.findMany({
      where: { developmentId },
      orderBy: { updatedAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async createTemplate(
    developmentId: string,
    userId: string,
    body: { name: string; gestoraLabel?: string; columnMapping: SpreadsheetColumnMapping },
  ) {
    await this.assertDevelopment(developmentId);
    this.validation.assertMappingComplete(body.columnMapping);
    return this.prisma.spreadsheetImportTemplate.create({
      data: {
        name: body.name.trim(),
        gestoraLabel: body.gestoraLabel?.trim() || null,
        developmentId,
        columnMapping: body.columnMapping as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
  }

  async updateTemplate(
    developmentId: string,
    templateId: string,
    body: { name?: string; gestoraLabel?: string; columnMapping?: SpreadsheetColumnMapping },
  ) {
    const t = await this.prisma.spreadsheetImportTemplate.findFirst({
      where: { id: templateId, developmentId },
    });
    if (!t) throw new NotFoundException('Template não encontrado');
    if (body.columnMapping) this.validation.assertMappingComplete(body.columnMapping);
    return this.prisma.spreadsheetImportTemplate.update({
      where: { id: templateId },
      data: {
        name: body.name?.trim(),
        gestoraLabel: body.gestoraLabel === undefined ? undefined : body.gestoraLabel?.trim() || null,
        columnMapping:
          body.columnMapping != null
            ? (body.columnMapping as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  async deleteTemplate(developmentId: string, templateId: string) {
    const t = await this.prisma.spreadsheetImportTemplate.findFirst({
      where: { id: templateId, developmentId },
    });
    if (!t) throw new NotFoundException('Template não encontrado');
    await this.prisma.spreadsheetImportTemplate.delete({ where: { id: templateId } });
    return { ok: true };
  }

  private async assertDevelopment(developmentId: string) {
    const d = await this.prisma.development.findUnique({ where: { id: developmentId } });
    if (!d) throw new NotFoundException('Loteamento não encontrado');
  }

  private async reconcile(
    developmentId: string,
    dateIso: string,
    rows: string[][],
    headerRowIndex: number,
    mapping: SpreadsheetColumnMapping,
    sheetName: string,
  ): Promise<SpreadsheetReconcilePreview> {
    const development = await this.prisma.development.findUnique({
      where: { id: developmentId },
      select: { name: true },
    });
    if (!development) throw new NotFoundException('Loteamento não encontrado');
    const developmentNameNorm = normLabel(development.name);

    const lots = await this.prisma.lot.findMany({
      where: { block: { developmentId } },
      include: { block: true },
    });
    const lookup = new Map<string, { lotId: string; blockName: string; number: string }>();
    for (const lot of lots) {
      const k = `${normLabel(lot.block.name)}|${normLabel(lot.number)}`;
      lookup.set(k, { lotId: lot.id, blockName: lot.block.name, number: lot.number });
    }

    const mappedRows = this.parsing.mapDataRows(rows, headerRowIndex, mapping);

    const current = await this.dailyAvailability.getCurrent(developmentId, dateIso);
    const prevByLot = new Map(
      (current.latest?.lotSnapshots ?? []).map((s) => [s.lotId, s.status as LotDailySnapshotStatus]),
    );

    const overrides = new Map<
      string,
      { status: LotDailySnapshotStatus; price?: number; notes?: string; sourceRow: number }
    >();
    const unmatchedRows: SpreadsheetReconcilePreview['unmatchedRows'] = [];
    const invalidRows: SpreadsheetReconcilePreview['invalidRows'] = [];
    let duplicateWarnings = 0;
    let rowsSkippedBlank = 0;

    const baseRowOffset = headerRowIndex + 2;

    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      const rowIndex = baseRowOffset + i;
      const blockRaw = row.block?.trim() ?? '';
      const lotRaw = row.lotNumber?.trim() ?? '';
      const statusRaw = row.status?.trim() ?? '';

      if (!blockRaw && !lotRaw) {
        rowsSkippedBlank++;
        continue;
      }

      if (!blockRaw || !lotRaw) {
        invalidRows.push({ rowIndex, reason: 'Quadra ou lote vazio' });
        continue;
      }

      if (mapping.developmentName?.trim()) {
        const devCell = row.developmentName?.trim() ?? '';
        if (devCell && normLabel(devCell) !== developmentNameNorm) {
          unmatchedRows.push({
            rowIndex,
            reason: 'Coluna de loteamento não corresponde ao empreendimento selecionado',
            block: blockRaw,
            lot: lotRaw,
          });
          continue;
        }
      }

      const st = parseSnapshotStatusFromText(statusRaw);
      if (!st) {
        invalidRows.push({ rowIndex, reason: `Status não reconhecido: "${statusRaw || '(vazio)'}"` });
        continue;
      }

      const key = `${normLabel(blockRaw)}|${normLabel(lotRaw)}`;
      let hit = lookup.get(key);
      if (!hit) {
        const altKey = tryAlternateLotKey(lookup, blockRaw, lotRaw);
        if (altKey) hit = lookup.get(altKey);
      }

      if (!hit) {
        unmatchedRows.push({ rowIndex, reason: 'Lote não encontrado no cadastro', block: blockRaw, lot: lotRaw });
        continue;
      }

      if (overrides.has(hit.lotId)) duplicateWarnings++;
      const price = row.price ? parseMoney(row.price) : undefined;
      const notes = row.notes?.trim() || undefined;
      overrides.set(hit.lotId, { status: st, price, notes, sourceRow: rowIndex });
    }

    const snapshots: SpreadsheetReconcilePreview['snapshots'] = [];
    const changesVsPrevious: SpreadsheetReconcilePreview['changesVsPrevious'] = [];
    const matchedSample: SpreadsheetReconcilePreview['matchedSample'] = [];

    for (const lot of lots) {
      const o = overrides.get(lot.id);
      const prev = prevByLot.get(lot.id);
      const baseStatus = o?.status ?? prev ?? propertyStatusToSnapshot(lot.status);
      const snapRow = current.latest?.lotSnapshots?.find((x) => x.lotId === lot.id);
      const fallbackPrice =
        snapRow?.price != null ? Number(snapRow.price) : lot.price != null ? Number(lot.price) : undefined;
      const price = o?.price != null ? o.price : fallbackPrice;
      const notes = o?.notes;
      snapshots.push({
        lotId: lot.id,
        status: baseStatus,
        price,
        notes,
      });
      if (o && prev !== o.status) {
        changesVsPrevious.push({
          lotId: lot.id,
          from: prev ?? null,
          to: o.status,
          block: lot.block.name,
          lotNumber: lot.number,
        });
      }
      if (o) {
        matchedSample.push({
          rowIndex: o.sourceRow,
          lotId: lot.id,
          block: lot.block.name,
          lotNumber: lot.number,
          status: o.status,
        });
      }
    }

    matchedSample.sort((a, b) => a.rowIndex - b.rowIndex);

    return {
      developmentId,
      date: dateIso,
      sheetName,
      totalRowsInFile: rows.length,
      dataRows: mappedRows.length,
      rowsSkippedBlank,
      matchedFromSheet: overrides.size,
      unmatchedRows,
      invalidRows,
      duplicateRowWarnings: duplicateWarnings,
      changesVsPrevious,
      snapshots,
      matchedSample: matchedSample.slice(0, 80),
    };
  }
}

function tryAlternateLotKey(
  lookup: Map<string, { lotId: string; blockName: string; number: string }>,
  blockRaw: string,
  lotRaw: string,
): string | undefined {
  const bn = normLabel(blockRaw);
  const n = lotRaw.trim();
  const asNum = Number(n.replace(',', '.'));
  if (!Number.isFinite(asNum)) return undefined;
  const candidates = [String(asNum), String(Math.trunc(asNum)), n.padStart(2, '0'), n.padStart(3, '0')];
  for (const c of candidates) {
    const k = `${bn}|${normLabel(c)}`;
    if (lookup.has(k)) return k;
  }
  return undefined;
}
