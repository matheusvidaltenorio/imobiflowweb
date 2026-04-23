import { Injectable } from '@nestjs/common';
import { PropertyIntent } from '@prisma/client';

/** Rascunho editável no frontend (não persiste sozinho). */
export type ExtractedProfileDraft = {
  clientName?: string;
  phone?: string;
  email?: string;
  city?: string;
  neighborhood?: string;
  developmentName?: string;
  propertyTypeHint?: string;
  budgetMin?: number;
  budgetMax?: number;
  downPayment?: number;
  installmentDesired?: number;
  minAreaM2?: number;
  maxAreaM2?: number;
  intent?: PropertyIntent;
  notes?: string;
  rawTranscript: string;
  parserVersion: string;
};

@Injectable()
export class TranscriptExtractionService {
  /** Heurística leve (PT-BR) — sempre revisar antes de salvar. */
  extractHeuristic(transcript: string): ExtractedProfileDraft {
    const t = transcript.trim();
    const out: ExtractedProfileDraft = {
      rawTranscript: t,
      parserVersion: 'heuristic-v1',
    };

    const emailM = t.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    if (emailM) out.email = emailM[0];

    const phoneM = t.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/);
    if (phoneM) out.phone = phoneM[0].replace(/\s+/g, ' ').trim();

    const mil = t.match(/(?:até|ate|máximo|maximo|ate\s+r\$)\s*R\$\s*([\d.,]+)/i);
    const mil2 = t.match(/R\$\s*([\d.,]+)\s*(?:mil|k)/i);
    if (mil2) {
      const n = this.parseMoney(mil2[1]);
      if (n != null) out.budgetMax = n * 1000;
    } else if (mil) {
      const n = this.parseMoney(mil[1]);
      if (n != null) out.budgetMax = n;
    }

    const area = t.match(/(\d{2,4})\s*m(?:²|2|metros)/i);
    if (area) out.minAreaM2 = parseInt(area[1], 10);

    if (/invest/i.test(t)) out.intent = PropertyIntent.INVESTIR;
    else if (/morar|residir|família|familia/i.test(t)) out.intent = PropertyIntent.MORAR;

    const nameLine = t.match(/(?:meu nome é|sou (?:o|a)?)\s+([A-Za-zÀ-ú]+(?:\s+[A-Za-zÀ-ú]+){0,3})/i);
    if (nameLine) out.clientName = nameLine[1].trim();

    out.notes = t.length > 400 ? `${t.slice(0, 400)}…` : t;
    return out;
  }

  private parseMoney(s: string): number | null {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
}
