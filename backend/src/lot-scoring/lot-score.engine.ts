/**
 * Motor puro de score de venda (0–100). Pesos agregados — ajuste em SCORE_WEIGHTS.
 */
export const SCORE_WEIGHTS = {
  priceAttractiveness: 0.3,
  marketInterest: 0.3,
  liquidityProfile: 0.2,
  timeInStock: 0.1,
  manualHighlight: 0.1,
} as const;

export type LotScoreInput = {
  price: number | null;
  area: number | null;
  viewCount: number;
  contactCount: number;
  scheduledVisitsCount: number;
  proposalsCount: number;
  manualHighlight: boolean;
  availableSince: Date | null;
  createdAt: Date;
};

export type CohortLot = LotScoreInput;

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Normaliza para ~30–100 quando há referência no coorte */
function norm(value: number, cohortMax: number): number {
  if (cohortMax <= 0) return value > 0 ? 72 : 48;
  const t = clamp(value / cohortMax, 0, 1);
  return Math.round(30 + 70 * t);
}

function scorePriceAttractiveness(lot: LotScoreInput, cohort: CohortLot[]): number {
  const prices = cohort.map((l) => l.price).filter((p): p is number => p != null && p > 0);
  const med = median(prices);
  if (lot.price == null || lot.price <= 0 || med == null || med <= 0) return 50;
  const ratio = lot.price / med;
  if (ratio <= 0.75) return 98;
  if (ratio <= 0.9) return 86;
  if (ratio <= 1) return 74;
  if (ratio <= 1.1) return 58;
  if (ratio <= 1.25) return 40;
  return 22;
}

function scoreMarketInterest(lot: LotScoreInput, cohort: CohortLot[]): number {
  const maxV = Math.max(0, ...cohort.map((c) => c.viewCount), 1);
  const maxC = Math.max(0, ...cohort.map((c) => c.contactCount), 1);
  const maxVi = Math.max(0, ...cohort.map((c) => c.scheduledVisitsCount), 1);
  const maxP = Math.max(0, ...cohort.map((c) => c.proposalsCount), 1);
  const iv = norm(lot.viewCount, maxV);
  const ic = norm(lot.contactCount, maxC);
  const ivi = norm(lot.scheduledVisitsCount, maxVi);
  const ip = norm(lot.proposalsCount, maxP);
  return Math.round(0.28 * iv + 0.34 * ic + 0.26 * ivi + 0.12 * ip);
}

function scoreLiquidity(lot: LotScoreInput, cohort: CohortLot[]): number {
  const areas = cohort.map((l) => l.area).filter((a): a is number => a != null && a > 0);
  const medA = median(areas);
  const prices = cohort.map((l) => l.price).filter((p): p is number => p != null && p > 0);
  const sorted = [...prices].sort((a, b) => a - b);
  let q = 50;
  if (sorted.length >= 4 && lot.price != null && lot.price > 0) {
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    if (lot.price >= q1 && lot.price <= q3) q += 35;
    else q += 12;
  } else if (sorted.length && lot.price != null) {
    q += 20;
  }
  if (lot.area != null && lot.area > 0 && medA != null && medA > 0) {
    const r = lot.area / medA;
    if (r >= 0.75 && r <= 1.35) q += 25;
    else q += 8;
  }
  return clamp(q, 0, 100);
}

function scoreTimeInStock(lot: LotScoreInput): number {
  const ref = lot.availableSince ?? lot.createdAt;
  const days = Math.max(0, (Date.now() - new Date(ref).getTime()) / (86400 * 1000));
  if (days < 14) return 68;
  if (days < 45) return 92;
  if (days < 90) return 78;
  if (days < 150) return 52;
  if (days < 240) return 34;
  return 22;
}

function scoreManual(lot: LotScoreInput): number {
  return lot.manualHighlight ? 100 : 42;
}

function classificationFromScore(score: number): string {
  if (score >= 85) return 'EXCELENTE OPORTUNIDADE';
  if (score >= 70) return 'ALTA PRIORIDADE';
  if (score >= 50) return 'BOA OPCAO';
  if (score >= 30) return 'MEDIA SAIDA';
  return 'BAIXA PRIORIDADE';
}

function buildReason(
  factors: { price: number; interest: number; liquidity: number; time: number; manual: number },
  lot: LotScoreInput,
  cohort: CohortLot[],
): string {
  const parts: string[] = [];
  const prices = cohort.map((l) => l.price).filter((p): p is number => p != null && p > 0);
  const med = median(prices);
  if (lot.price != null && med != null && med > 0 && lot.price < med * 0.92) {
    parts.push('Preço abaixo da média do loteamento');
  } else if (lot.price != null && med != null && med > 0 && lot.price > med * 1.08) {
    parts.push('Preço acima do padrão do empreendimento');
  }
  if (lot.viewCount >= 5 && lot.contactCount <= 1) {
    parts.push('Muitas visualizações, poucas conversões');
  }
  if (lot.contactCount >= 3 || lot.scheduledVisitsCount >= 2) {
    parts.push('Forte interesse de mercado');
  }
  const days = Math.max(0, (Date.now() - new Date(lot.availableSince ?? lot.createdAt).getTime()) / (86400 * 1000));
  if (days > 120 && factors.interest < 55) {
    parts.push('Há muito tempo disponível com baixa conversão — avalie campanha');
  }
  if (lot.manualHighlight) {
    parts.push('Destaque manual ativo');
  }
  if (!parts.length) {
    if (factors.price >= 75 && factors.interest >= 60) return 'Bom equilíbrio entre preço e procura';
    if (factors.interest >= 75) return 'Alta procura relativa ao empreendimento';
    return 'Perfil comercial equilibrado; monitore interações';
  }
  return parts.slice(0, 3).join('. ') + '.';
}

export type LotScoreResult = {
  score: number;
  classification: string;
  reason: string;
  factors: { price: number; interest: number; liquidity: number; time: number; manual: number };
};

export function calculateLotSaleScore(lot: LotScoreInput, cohort: CohortLot[]): LotScoreResult {
  const price = scorePriceAttractiveness(lot, cohort);
  const interest = scoreMarketInterest(lot, cohort);
  const liquidity = scoreLiquidity(lot, cohort);
  const time = scoreTimeInStock(lot);
  const manual = scoreManual(lot);

  const w = SCORE_WEIGHTS;
  const raw =
    w.priceAttractiveness * price +
    w.marketInterest * interest +
    w.liquidityProfile * liquidity +
    w.timeInStock * time +
    w.manualHighlight * manual;

  const score = clamp(Math.round(raw), 0, 100);
  const classification = classificationFromScore(score);
  const factors = { price, interest, liquidity, time, manual };
  const reason = buildReason(factors, lot, cohort);

  return { score, classification, reason, factors };
}

/** Rótulos comerciais para UI (não persistidos) */
export function commercialTags(
  score: number,
  lot: LotScoreInput,
  cohort: CohortLot[],
): string[] {
  const tags: string[] = [];
  const prices = cohort.map((l) => l.price).filter((p): p is number => p != null && p > 0);
  const med = median(prices);
  const days = Math.max(0, (Date.now() - new Date(lot.availableSince ?? lot.createdAt).getTime()) / (86400 * 1000));
  const cheap = lot.price != null && med != null && med > 0 && lot.price <= med * 0.92;
  const hotDemand = lot.contactCount >= 2 || lot.scheduledVisitsCount >= 2;
  if (score >= 72 && cheap && hotDemand) tags.push('CAMPEAO_VENDA');
  if (days > 150 && score < 48 && lot.contactCount < 2) tags.push('NECESITA_ATENCAO_COMERCIAL');
  if (lot.viewCount >= 8 && lot.contactCount === 0) tags.push('BAIXA_CONVERSAO');
  return tags;
}

export function suggestedAction(score: number, tags: string[]): string {
  if (tags.includes('CAMPEAO_VENDA')) return 'Divulgar no WhatsApp hoje e priorizar no atendimento';
  if (tags.includes('NECESITA_ATENCAO_COMERCIAL')) return 'Criar campanha ou rever preço/condições';
  if (tags.includes('BAIXA_CONVERSAO')) return 'Ajustar pitch ou oferta; convidar para visita';
  if (score >= 75) return 'Priorizar este lote no atendimento';
  if (score >= 55) return 'Manter follow-up ativo com leads do lote';
  return 'Reavaliar precificação e mídia para o lote';
}
