import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { parsePolygonCoordinates, type LatLngPoint } from '@/lib/maps/polygon';

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
