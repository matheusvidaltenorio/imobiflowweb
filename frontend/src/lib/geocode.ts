import { api } from '@/lib/api';

export type GeocodeResult = { lat: number; lng: number };

/**
 * Geocodificação via API ImobiFlow (`POST /maps/geocode`).
 * O backend usa Google quando `GOOGLE_MAPS_API_KEY` está definida; caso contrário Nominatim (OSM).
 */
export async function geocodeAddress(params: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  zipCode?: string;
}): Promise<GeocodeResult | null> {
  const parts = [
    params.street,
    params.number,
    params.neighborhood,
    params.city,
    params.zipCode,
  ].filter(Boolean);

  if (parts.length < 2) return null;

  try {
    const { data } = await api.post<{ lat: number; lng: number; formattedAddress?: string }>('/maps/geocode', {
      address: [params.street, params.number].filter(Boolean).join(', '),
      neighborhood: params.neighborhood,
      city: params.city,
      zipCode: params.zipCode,
    });
    if (data?.lat != null && data?.lng != null) {
      return { lat: Number(data.lat), lng: Number(data.lng) };
    }
    return null;
  } catch {
    return null;
  }
}

/** Abrir busca no OpenStreetMap (link externo; mapa do sistema é MapLibre). */
export function buildMapsSearchUrl(params: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  zipCode?: string;
}): string {
  const parts = [
    params.street,
    params.number,
    params.neighborhood,
    params.city,
    params.zipCode,
  ].filter(Boolean);
  const query = parts.join(', ');
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}
