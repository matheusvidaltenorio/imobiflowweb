const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export type GeocodeResult = { lat: number; lng: number };

export async function geocodeAddress(params: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  zipCode?: string;
}): Promise<GeocodeResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const parts = [
    params.street,
    params.number,
    params.neighborhood,
    params.city,
    params.zipCode,
  ].filter(Boolean);

  if (parts.length < 2) return null;

  const address = parts.join(', ');
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status === 'OK' && data.results?.[0]) {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  }

  return null;
}

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
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
