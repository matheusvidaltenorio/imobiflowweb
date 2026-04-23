/** Tipos de notificação in-app para mudanças de disponibilidade e match. */
export const AvailAlertType = {
  LOT_AVAILABLE_NEW: 'AVAIL_LOT_AVAILABLE_NEW',
  LOT_AVAILABLE_BACK: 'AVAIL_LOT_AVAILABLE_BACK',
  LOT_SOLD: 'AVAIL_LOT_SOLD',
  LOT_RESERVED: 'AVAIL_LOT_RESERVED',
  LOT_NEGOTIATION: 'AVAIL_LOT_NEGOTIATION',
  LOT_PRICE_CHANGED: 'AVAIL_LOT_PRICE_CHANGED',
  MATCH_CLIENT: 'AVAIL_MATCH_CLIENT',
  DEVELOPMENT_SUMMARY: 'AVAIL_DEVELOPMENT_SUMMARY',
} as const;

export type AvailAlertTypeValue = (typeof AvailAlertType)[keyof typeof AvailAlertType];

export const AVAIL_ALERT_AGGREGATE_THRESHOLD = 14;
export const AVAIL_ALERT_MAX_INDIVIDUAL_PER_BROKER = 26;
export const AVAIL_MATCH_SCORE_MIN = 0.72;
