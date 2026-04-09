import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Categorias internas alinhadas a amenities/tags OSM comuns. */
export const NEARBY_CATEGORIES = [
  'supermarket',
  'pharmacy',
  'fast_food',
  'restaurant',
  'school',
  'fuel',
  'hospital',
  'clinic',
  'bank',
  'atm',
  'cafe',
  'gym',
  'church',
] as const;

export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number];

export type OverpassPoi = {
  category: NearbyCategory;
  subcategory?: string;
  name: string;
  lat: number;
  lng: number;
  sourceOsmId: string;
  shortAddress?: string;
};

/** Pares tag OSM por categoria (node/way). */
const OSM_QUERIES: Record<NearbyCategory, string[]> = {
  supermarket: ['["shop"="supermarket"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
  fast_food: ['["amenity"="fast_food"]'],
  restaurant: ['["amenity"="restaurant"]'],
  school: ['["amenity"="school"]'],
  fuel: ['["amenity"="fuel"]'],
  hospital: ['["amenity"="hospital"]'],
  clinic: ['["amenity"="clinic"]'],
  bank: ['["amenity"="bank"]'],
  atm: ['["amenity"="atm"]'],
  cafe: ['["amenity"="cafe"]'],
  gym: ['["leisure"="fitness_centre"]', '["amenity"="gym"]'],
  church: ['["amenity"="place_of_worship"]'],
};

@Injectable()
export class OverpassNearbyService {
  private readonly logger = new Logger(OverpassNearbyService.name);

  constructor(private readonly config: ConfigService) {}

  private overpassUrl(): string {
    return (
      this.config.get<string>('OVERPASS_API_URL')?.replace(/\/$/, '') ||
      'https://overpass-api.de/api/interpreter'
    );
  }

  buildQuery(lat: number, lng: number, radiusMeters: number, categories?: NearbyCategory[]): string {
    const use = categories?.length ? categories : [...NEARBY_CATEGORIES];
    const parts: string[] = [];
    for (const cat of use) {
      const tags = OSM_QUERIES[cat];
      for (const tag of tags) {
        parts.push(`node${tag}(around:${radiusMeters},${lat},${lng});`);
        parts.push(`way${tag}(around:${radiusMeters},${lat},${lng});`);
      }
    }
    return `[out:json][timeout:90];(${parts.join('')});out center;`;
  }

  async fetchNearby(
    lat: number,
    lng: number,
    radiusMeters: number,
    categories?: NearbyCategory[],
  ): Promise<OverpassPoi[]> {
    const q = this.buildQuery(lat, lng, radiusMeters, categories);
    const res = await fetch(this.overpassUrl(), {
      method: 'POST',
      body: `data=${encodeURIComponent(q)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ImobiFlow/1.0 (+https://github.com/matheusvidaltenorio/imobiflowweb)',
      },
      signal: AbortSignal.timeout(95_000),
    });

    if (!res.ok) {
      this.logger.warn(`Overpass HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      elements?: Array<{
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };

    const elements = data.elements ?? [];
    const out: OverpassPoi[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const latP = el.lat ?? el.center?.lat;
      const lonP = el.lon ?? el.center?.lon;
      if (latP == null || lonP == null) continue;

      const tags = el.tags ?? {};
      const category = this.inferCategory(tags);
      if (!category) continue;

      const name =
        tags.name ||
        tags.brand ||
        tags.operator ||
        tags['name:pt'] ||
        `${category} (${el.type}/${el.id})`;
      const key = `${el.type}/${el.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const sub =
        tags.shop ||
        tags.amenity ||
        tags.leisure ||
        tags.healthcare ||
        undefined;
      const addr = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ') || undefined;

      out.push({
        category,
        subcategory: sub,
        name,
        lat: latP,
        lng: lonP,
        sourceOsmId: key,
        shortAddress: addr,
      });
    }

    return out;
  }

  private inferCategory(tags: Record<string, string>): NearbyCategory | null {
    const shop = tags.shop;
    const amenity = tags.amenity;
    const leisure = tags.leisure;

    if (shop === 'supermarket') return 'supermarket';
    if (amenity === 'pharmacy') return 'pharmacy';
    if (amenity === 'fast_food') return 'fast_food';
    if (amenity === 'restaurant') return 'restaurant';
    if (amenity === 'school') return 'school';
    if (amenity === 'fuel') return 'fuel';
    if (amenity === 'hospital') return 'hospital';
    if (amenity === 'clinic') return 'clinic';
    if (amenity === 'bank') return 'bank';
    if (amenity === 'atm') return 'atm';
    if (amenity === 'cafe') return 'cafe';
    if (leisure === 'fitness_centre' || amenity === 'gym') return 'gym';
    if (amenity === 'place_of_worship') return 'church';
    return null;
  }
}
