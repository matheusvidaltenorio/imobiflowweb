/**
 * Monta string de busca compatível com Nominatim (ou serviços similares).
 * Não chama rede — use no backend (/maps/geocode) ou em fluxos futuros.
 */
export type DevelopmentLocationParts = {
  referenceAddress?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city: string;
  state?: string | null;
};

export function buildNominatimStyleGeocodeQuery(d: DevelopmentLocationParts): string {
  const parts = [d.referenceAddress, d.neighborhood, d.address, d.city, d.state].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0,
  );
  return parts.join(', ');
}
