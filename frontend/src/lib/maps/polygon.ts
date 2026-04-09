export type LatLngPoint = { lat: number; lng: number };

export function parsePolygonCoordinates(raw: unknown): LatLngPoint[] | null {
  if (!raw || !Array.isArray(raw) || raw.length < 3) return null;
  const out: LatLngPoint[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') return null;
    const o = p as Record<string, unknown>;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    out.push({ lat, lng });
  }
  return out;
}

/** @deprecated nome legado; use toLatLngPath */
export function toGooglePath(points: LatLngPoint[]): { lat: number; lng: number }[] {
  return points.map((p) => ({ lat: p.lat, lng: p.lng }));
}

export function toLatLngPath(points: LatLngPoint[]): { lat: number; lng: number }[] {
  return toGooglePath(points);
}
