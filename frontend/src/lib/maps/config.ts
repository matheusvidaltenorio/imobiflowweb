/** Estilo MapLibre (vector tiles). Padrão: CARTO Positron (sem API key). */
const DEFAULT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export function getMapStyleUrl(): string {
  const u = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  return u || DEFAULT_STYLE;
}

/** Centro padrão (Brasil) quando não há coordenadas. */
export function getDefaultMapCenter(): { lat: number; lng: number } {
  const lat =
    process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_DEFAULT_LAT?.trim() ||
    '-14.235';
  const lng =
    process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_DEFAULT_LNG?.trim() ||
    '-51.9253';
  return { lat: Number(lat), lng: Number(lng) };
}

export function getDefaultMapZoom(): number {
  const z = Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM ?? '5');
  return Number.isFinite(z) ? z : 5;
}
