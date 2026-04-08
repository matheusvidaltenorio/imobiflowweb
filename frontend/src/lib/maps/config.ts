/** Centro padrão (Brasil) quando não há coordenadas. */
export function getDefaultMapCenter(): { lat: number; lng: number } {
  return {
    lat: Number(process.env.NEXT_PUBLIC_GOOGLE_MAPS_DEFAULT_LAT ?? '-14.235'),
    lng: Number(process.env.NEXT_PUBLIC_GOOGLE_MAPS_DEFAULT_LNG ?? '-51.9253'),
  };
}

export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
}

export function getGoogleMapsMapId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim();
  return id || undefined;
}
