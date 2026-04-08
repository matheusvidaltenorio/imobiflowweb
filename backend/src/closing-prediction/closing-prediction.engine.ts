/**
 * Previsão determinística de fechamento (0–100). Ajuste pesos em CLOSING_WEIGHTS.
 */
import { LeadStatus } from '@prisma/client';

export const CLOSING_WEIGHTS = {
  funnelStage: 0.25,
  temperature: 0.1,
  recency: 0.15,
  engagement: 0.15,
  visits: 0.1,
  proposal: 0.1,
  timePipeline: 0.05,
  lotQuality: 0.05,
  financial: 0.05,
} as const;

export type ClosingPredictionInput = {
  status: LeadStatus;
  isHot: boolean;
  interactionCount: number;
  /** Interações iniciadas pelo lead / público (ex.: touch, visita página) */
  responseCount: number;
  daysSinceLastInteraction: number;
  daysInPipeline: number;
  visitCompleted: boolean;
  visitScheduledFuture: boolean;
  proposalCount: number;
  financialFit: 'good' | 'bad' | 'unknown';
  lotSaleScore: number | null;
  lotTags: string[];
  lotBelowMedian: boolean;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function scoreFunnel(status: LeadStatus): number {
  switch (status) {
    case LeadStatus.VENDIDO:
      return 100;
    case LeadStatus.PERDIDO:
      return 0;
    case LeadStatus.NEGOCIACAO:
      return 88;
    case LeadStatus.QUALIFICACAO:
      return 58;
    case LeadStatus.PROSPECCAO:
    default:
      return 38;
  }
}

function scoreTemperature(isHot: boolean, daysSinceLastInteraction: number): number {
  let s = isHot ? 82 : 52;
  if (daysSinceLastInteraction > 14) s -= 22;
  else if (daysSinceLastInteraction > 7) s -= 12;
  return clamp(s, 15, 100);
}

function scoreRecency(days: number): number {
  if (days <= 0) return 100;
  if (days <= 2) return 92;
  if (days <= 5) return 78;
  if (days <= 10) return 58;
  if (days <= 20) return 38;
  return 22;
}

function scoreEngagement(interactionCount: number, responseCount: number): number {
  const base = 35 + Math.min(35, interactionCount * 6) + Math.min(25, responseCount * 5);
  return clamp(base, 18, 100);
}

function scoreVisits(completed: boolean, scheduled: boolean): number {
  if (completed) return 100;
  if (scheduled) return 78;
  return 42;
}

function scoreProposal(count: number): number {
  if (count >= 2) return 100;
  if (count === 1) return 88;
  return 38;
}

/** Lead novo com engajamento vs parado há muito tempo */
function scoreTimePipeline(daysInPipeline: number, daysSinceLastInteraction: number): number {
  let s = 60;
  if (daysInPipeline <= 14 && daysSinceLastInteraction <= 5) s += 25;
  if (daysInPipeline > 60 && daysSinceLastInteraction > 10) s -= 28;
  if (daysInPipeline > 120) s -= 12;
  return clamp(s, 20, 100);
}

function scoreLotQuality(
  saleScore: number | null,
  tags: string[],
  belowMedian: boolean,
): number {
  let s = saleScore != null ? 35 + (saleScore / 100) * 55 : 52;
  if (tags.includes('CAMPEAO_VENDA')) s += 14;
  if (tags.includes('NECESITA_ATENCAO_COMERCIAL')) s -= 10;
  if (tags.includes('BAIXA_CONVERSAO')) s -= 6;
  if (belowMedian) s += 8;
  return clamp(Math.round(s), 15, 100);
}

function scoreFinancial(fit: 'good' | 'bad' | 'unknown'): number {
  if (fit === 'good') return 88;
  if (fit === 'bad') return 32;
  return 58;
}

function classificationFromScore(score: number, status: LeadStatus): string {
  if (status === LeadStatus.VENDIDO) return 'FECHADO';
  if (status === LeadStatus.PERDIDO) return 'PERDIDO';
  if (score >= 85) return 'FECHAMENTO MUITO PROVAVEL';
  if (score >= 70) return 'ALTA CHANCE DE FECHAMENTO';
  if (score >= 50) return 'CHANCE MODERADA';
  if (score >= 30) return 'BAIXA CHANCE';
  return 'RISCO DE PERDA';
}

function interestLevel(score: number, isHot: boolean): string {
  if (isHot && score >= 65) return 'QUENTE';
  if (score >= 45) return 'MORNO';
  return 'FRIO';
}

function priorityLevel(score: number, daysSinceLastInteraction: number): string {
  if (score >= 75 && daysSinceLastInteraction <= 5) return 'ALTA';
  if (score >= 55 || daysSinceLastInteraction <= 3) return 'MEDIA';
  return 'BAIXA';
}

function buildReasonAndActions(
  input: ClosingPredictionInput,
  sub: Record<string, number>,
  finalScore: number,
): { reason: string; nextAction: string; positive: string[]; risks: string[] } {
  const positive: string[] = [];
  const risks: string[] = [];

  if (input.status === LeadStatus.NEGOCIACAO) positive.push('Etapa de negociação no funil');
  if (input.isHot) positive.push('Lead marcado como quente');
  if (input.daysSinceLastInteraction <= 2) positive.push('Resposta ou contato muito recente');
  if (input.visitCompleted) positive.push('Visita ao lote já realizada');
  else if (input.visitScheduledFuture) positive.push('Visita agendada');
  if (input.proposalCount > 0) positive.push('Proposta registrada no sistema');
  if (input.lotTags.includes('CAMPEAO_VENDA')) positive.push('Lote campeão no ranking comercial');
  if (input.lotBelowMedian) positive.push('Lote com preço competitivo no empreendimento');
  if (input.financialFit === 'good') positive.push('Simulação com boa aderência à renda');

  if (input.daysSinceLastInteraction >= 10) {
    risks.push(`${input.daysSinceLastInteraction} dias sem nova interação`);
  }
  if (!input.visitCompleted && !input.visitScheduledFuture && input.status !== LeadStatus.PROSPECCAO) {
    risks.push('Ainda sem visita agendada ou realizada');
  }
  if (input.proposalCount === 0 && input.status === LeadStatus.NEGOCIACAO) {
    risks.push('Em negociação sem proposta formal vinculada ao cliente');
  }
  if (input.financialFit === 'bad') risks.push('Indicadores de parcela elevada frente à renda');
  if (input.lotTags.includes('NECESITA_ATENCAO_COMERCIAL')) {
    risks.push('Lote com baixa conversão no empreendimento');
  }

  const parts: string[] = [];
  if (input.status === LeadStatus.NEGOCIACAO) parts.push('em negociação');
  if (input.visitCompleted) parts.push('já visitou o lote');
  if (input.daysSinceLastInteraction <= 3) parts.push('respondeu ou interagiu recentemente');
  if (input.proposalCount > 0) parts.push('com proposta em andamento');
  const reason =
    parts.length > 0
      ? `Lead ${parts.join(', ')}.`
      : finalScore >= 55
        ? 'Combinação equilibrada de funil, engajamento e contexto do lote.'
        : 'Pouco engajamento recente ou estágio inicial do funil.';

  let nextAction = 'Manter relacionamento e registrar próximas interações';
  if (input.status === LeadStatus.PERDIDO || finalScore < 25) {
    nextAction = 'Reavaliar abordagem ou marcar oportunidade futura';
  } else if (input.financialFit === 'bad') {
    nextAction = 'Revisar condição comercial e simulação com o cliente';
  } else if (input.daysSinceLastInteraction >= 8) {
    nextAction = 'Retomar contato hoje com mensagem leve';
  } else if (!input.visitScheduledFuture && !input.visitCompleted && input.status !== LeadStatus.PROSPECCAO) {
    nextAction = 'Agendar visita ao lote';
  } else if (input.status === LeadStatus.NEGOCIACAO && input.proposalCount === 0) {
    nextAction = 'Enviar proposta detalhada hoje';
  } else if (finalScore >= 78) {
    nextAction = 'Priorizar este lead hoje — avançar fechamento ou confirmação';
  } else if (input.visitCompleted && input.status === LeadStatus.QUALIFICACAO) {
    nextAction = 'Confirmar interesse e conduzir para negociação';
  }

  return { reason, nextAction, positive, risks };
}

export type ClosingPredictionResult = {
  score: number;
  classification: string;
  reason: string;
  nextAction: string;
  interestLevel: string;
  priorityLevel: string;
  positiveFactors: string[];
  riskFactors: string[];
  subscores: Record<string, number>;
};

export function calculateClosingPrediction(input: ClosingPredictionInput): ClosingPredictionResult {
  if (input.status === LeadStatus.VENDIDO) {
    return {
      score: 100,
      classification: 'FECHADO',
      reason: 'Lead convertido em venda.',
      nextAction: 'Manter pós-venda e documentação.',
      interestLevel: 'QUENTE',
      priorityLevel: 'ALTA',
      positiveFactors: ['Venda concluída'],
      riskFactors: [],
      subscores: {},
    };
  }
  if (input.status === LeadStatus.PERDIDO) {
    return {
      score: 0,
      classification: 'PERDIDO',
      reason: 'Lead marcado como perdido.',
      nextAction: 'Arquivar ou reabrir apenas com novo contexto.',
      interestLevel: 'FRIO',
      priorityLevel: 'BAIXA',
      positiveFactors: [],
      riskFactors: ['Status perdido'],
      subscores: {},
    };
  }

  const w = CLOSING_WEIGHTS;
  const sub = {
    funnel: scoreFunnel(input.status),
    temperature: scoreTemperature(input.isHot, input.daysSinceLastInteraction),
    recency: scoreRecency(input.daysSinceLastInteraction),
    engagement: scoreEngagement(input.interactionCount, input.responseCount),
    visits: scoreVisits(input.visitCompleted, input.visitScheduledFuture),
    proposal: scoreProposal(input.proposalCount),
    timePipeline: scoreTimePipeline(input.daysInPipeline, input.daysSinceLastInteraction),
    lotQuality: scoreLotQuality(input.lotSaleScore, input.lotTags, input.lotBelowMedian),
    financial: scoreFinancial(input.financialFit),
  };

  const raw =
    w.funnelStage * sub.funnel +
    w.temperature * sub.temperature +
    w.recency * sub.recency +
    w.engagement * sub.engagement +
    w.visits * sub.visits +
    w.proposal * sub.proposal +
    w.timePipeline * sub.timePipeline +
    w.lotQuality * sub.lotQuality +
    w.financial * sub.financial;

  const score = clamp(Math.round(raw), 1, 99);
  const classification = classificationFromScore(score, input.status);
  const { reason, nextAction, positive, risks } = buildReasonAndActions(input, sub, score);

  return {
    score,
    classification,
    reason,
    nextAction,
    interestLevel: interestLevel(score, input.isHot),
    priorityLevel: priorityLevel(score, input.daysSinceLastInteraction),
    positiveFactors: positive,
    riskFactors: risks,
    subscores: sub,
  };
}

/** Tendência entre score anterior e atual */
export function closingScoreTrend(
  previous: number | null | undefined,
  current: number,
): 'up' | 'down' | 'stable' {
  if (previous == null || Number.isNaN(Number(previous))) return 'stable';
  const d = current - Number(previous);
  if (d >= 5) return 'up';
  if (d <= -5) return 'down';
  return 'stable';
}
