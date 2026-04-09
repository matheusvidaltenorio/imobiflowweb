import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { parsePolygonCoordinates, type LatLngPoint } from '@/lib/maps/polygon';

const EARTH_RADIUS_M = 6_371_000;

/** Anel fechado (~polígono) aproximando um círculo geodésico (fallback visual sem polígono cadastrado). */
export function circleRingLatLng(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  sides = 48,
): LatLngPoint[] {
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || radiusMeters <= 0) return [];
  const φ1 = (centerLat * Math.PI) / 180;
  const λ1 = (centerLng * Math.PI) / 180;
  const δ = radiusMeters / EARTH_RADIUS_M;
  const ring: LatLngPoint[] = [];
  for (let i = 0; i <= sides; i++) {
    const θ = (2 * Math.PI * i) / sides;
    const sinφ1 = Math.sin(φ1);
    const cosφ1 = Math.cos(φ1);
    const sinδ = Math.sin(δ);
    const cosδ = Math.cos(δ);
    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
    const φ2 = Math.asin(sinφ2);
    const y = Math.sin(θ) * sinδ * cosφ1;
    const x = cosδ - sinφ1 * sinφ2;
    let λ2 = λ1 + Math.atan2(y, x);
    λ2 = ((((λ2 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    ring.push({ lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI });
  }
  return ring;
}

/** GeoJSON usa [longitude, latitude]. */
export function ringLatLngToGeoJson(ring: LatLngPoint[]): number[][] {
  const coords = ring.map((p) => [p.lng, p.lat] as [number, number]);
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...coords, [...first]];
  }
  return coords;
}

export function polygonFeatureFromLatLng(
  points: LatLngPoint[],
  properties: Record<string, string | number | boolean | null>,
): Feature<Polygon> | null {
  const ring = ringLatLngToGeoJson(points);
  if (ring.length < 4) return null;
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}

export function emptyFeatureCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export function extendBoundsLngLat(
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null,
  lng: number,
  lat: number,
): { minLng: number; minLat: number; maxLng: number; maxLat: number } {
  if (!bounds) {
    return { minLng: lng, maxLng: lng, minLat: lat, maxLat: lat };
  }
  return {
    minLng: Math.min(bounds.minLng, lng),
    maxLng: Math.max(bounds.maxLng, lng),
    minLat: Math.min(bounds.minLat, lat),
    maxLat: Math.max(bounds.maxLat, lat),
  };
}

export function boundsFromPoints(points: { lng: number; lat: number }[]): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} | null {
  if (!points.length) return null;
  let b = extendBoundsLngLat(null, points[0].lng, points[0].lat);
  for (let i = 1; i < points.length; i++) {
    b = extendBoundsLngLat(b, points[i].lng, points[i].lat);
  }
  return b;
}

export function boundsFromPolygonCoordinates(raw: unknown): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} | null {
  const p = parsePolygonCoordinates(raw);
  if (!p?.length) return null;
  return boundsFromPoints(p);
}

export function boundsFromFeatureCollection(fc: FeatureCollection): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} | null {
  let merged: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null = null;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g || g.type !== 'Polygon') continue;
    const outer = g.coordinates[0];
    for (const [lng, lat] of outer) {
      merged = extendBoundsLngLat(merged, lng, lat);
    }
  }
  return merged;
}
