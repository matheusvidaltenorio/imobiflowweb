/**
 * Contratos do assistente comercial (templates + futura LLM).
 * Mantidos como strings alinhadas ao Prisma `AiSuggestionMessageType` / `AiSuggestionTone`.
 */
export type CommercialMessageType =
  | 'PRIMEIRO_CONTATO'
  | 'FOLLOW_UP'
  | 'VISITA'
  | 'OPORTUNIDADE'
  | 'RETOMADA'
  | 'URGENCIA'
  | 'POS_VISITA'
  | 'NEGOCIACAO'
  | 'REATIVACAO_ENCALHADO';

export type CommercialTone = 'OBJETIVO' | 'CONSULTIVO' | 'PERSUASIVO';

export type CommercialMessageContext = {
  variantSeed: number;
  lead?: {
    firstName: string;
    fullName: string;
    status: string;
    isHot: boolean;
    source?: string | null;
    notes?: string | null;
    daysSinceLastInteraction: number;
    interactionCount: number;
    /** Previsão de fechamento (ClosingPredictionModule) */
    closingScore?: number;
    closingPrediction?: string;
    closingNextAction?: string;
    closingTrend?: 'up' | 'down' | 'stable';
  };
  lot?: {
    number: string;
    blockName: string;
    developmentName: string;
    city?: string | null;
    priceText: string;
    areaText: string;
    status: string;
    saleScore: number | null;
    saleClassification: string | null;
    saleScoreReason: string | null;
    tags: string[];
    belowMedianPrice: boolean;
    daysOnMarket: number;
    viewCount: number;
    contactCount: number;
  };
  property?: {
    title: string;
    priceText: string;
  };
  hasUpcomingVisit: boolean;
  upcomingVisitLabel?: string;
  hadRecentCompletedVisit: boolean;
};

export type ComposedSuggestion = {
  tone: CommercialTone;
  message: string;
  justification: string;
};

export type LeadMessageBundle = {
  primaryType: CommercialMessageType;
  typeLabel: string;
  contactTiming: string;
  recommendedTone: CommercialTone;
  nextAction: string;
  strategySummary: string;
  lotSummary: string[];
  suggestions: ComposedSuggestion[];
};

export type LotPitchBundle = {
  primaryType: CommercialMessageType;
  arguments: string[];
  lotSummary: string[];
  suggestions: ComposedSuggestion[];
  strategySummary: string;
};

/** Contrato para futuro provider LLM (OpenAI, etc.) */
export interface CommercialMessageProvider {
  composeLead(ctx: CommercialMessageContext): Promise<LeadMessageBundle>;
  composeLotPitch(ctx: CommercialMessageContext): Promise<LotPitchBundle>;
}
