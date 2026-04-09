'use client';

/**
 * Seção de mapa do loteamento: o layout completo fica em `DevelopmentLotsMap`.
 * Export simbólico para alinhar à arquitetura pedida (mapa + legenda + painel).
 */
export { DevelopmentLotsMap as LoteamentoMapSection } from '@/components/maps/development-lots-map';
export type { GeoMapDevelopment, GeoMapLot, GeoMapNearbyPlace } from '@/components/maps/development-lots-map';
