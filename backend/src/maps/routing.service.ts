import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type TravelMode = 'driving' | 'walking';

export type RouteEstimate = {
  distanceMeters: number;
  travelTimeMinutes: number;
  routeSource: 'osrm' | 'haversine_speed_estimate';
};

/** Velocidades médias urbanas quando OSRM não responde (estimativa, não rota real). */
const FALLBACK_KMH: Record<TravelMode, number> = {
  driving: 32,
  walking: 4.5,
};

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly config: ConfigService) {}

  haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371000;
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const s =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    return R * c;
  }

  private fallbackEstimate(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    mode: TravelMode,
  ): RouteEstimate {
    const distanceMeters = Math.round(this.haversineMeters(from, to));
    const hours = distanceMeters / 1000 / FALLBACK_KMH[mode];
    const travelTimeMinutes = Math.max(1, Math.round(hours * 60));
    return { distanceMeters, travelTimeMinutes, routeSource: 'haversine_speed_estimate' };
  }

  /**
   * Duração e distância via OSRM público (ou instância em `OSRM_BASE_URL`).
   * Em falha ou limite, usa distância em linha reta + velocidade média (marcado em routeSource).
   */
  async estimateRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    mode: TravelMode,
  ): Promise<RouteEstimate> {
    const base =
      this.config.get<string>('OSRM_BASE_URL')?.replace(/\/$/, '') || 'https://router.project-osrm.org';
    const profile = mode === 'walking' ? 'foot' : 'driving';
    const url = `${base}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) {
        this.logger.warn(`OSRM HTTP ${res.status}`);
        return this.fallbackEstimate(from, to, mode);
      }
      const data = (await res.json()) as {
        code?: string;
        routes?: Array<{ distance: number; duration: number }>;
      };
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route) {
        return this.fallbackEstimate(from, to, mode);
      }
      return {
        distanceMeters: Math.round(route.distance),
        travelTimeMinutes: Math.max(1, Math.round(route.duration / 60)),
        routeSource: 'osrm',
      };
    } catch (e) {
      this.logger.warn(`OSRM erro: ${e instanceof Error ? e.message : e}`);
      return this.fallbackEstimate(from, to, mode);
    }
  }
}
