import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OverpassNearbyService, type NearbyCategory } from './overpass-nearby.service';
import { RoutingService, type TravelMode } from './routing.service';

const MAX_POIS_PER_REFRESH = 60;

@Injectable()
export class NearbyPlacesService {
  private readonly logger = new Logger(NearbyPlacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly overpass: OverpassNearbyService,
    private readonly routing: RoutingService,
  ) {}

  async listCached(
    developmentId: string,
    radiusMeters: number,
    travelMode: TravelMode,
    categoryFilter?: string,
  ) {
    const where: {
      developmentId: string;
      searchRadiusMeters: number;
      travelMode: string;
      category?: string;
    } = { developmentId, searchRadiusMeters: radiusMeters, travelMode };
    if (categoryFilter) where.category = categoryFilter;

    const rows = await this.prisma.developmentNearbyPlace.findMany({
      where,
      orderBy: [{ category: 'asc' }, { travelTimeMinutes: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      subcategory: r.subcategory,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      shortAddress: r.shortAddress,
      source: r.source,
      distanceMeters: r.distanceMeters,
      travelTimeMinutes: r.travelTimeMinutes,
      travelMode: r.travelMode,
      routeSource: r.routeSource,
      fetchedAt: r.fetchedAt,
    }));
  }

  async refreshFromOsm(
    developmentId: string,
    radiusMeters: number,
    travelMode: TravelMode,
    categories?: NearbyCategory[],
  ) {
    if (radiusMeters < 200 || radiusMeters > 25_000) {
      throw new BadRequestException('Raio deve estar entre 200 m e 25 km.');
    }

    const dev = await this.prisma.development.findUnique({
      where: { id: developmentId },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!dev) throw new NotFoundException('Loteamento não encontrado');
    if (dev.latitude == null || dev.longitude == null) {
      throw new BadRequestException('Loteamento sem latitude/longitude para buscar POIs.');
    }

    const origin = {
      lat: Number(dev.latitude),
      lng: Number(dev.longitude),
    };

    this.logger.log(
      `Overpass refresh dev=${developmentId} r=${radiusMeters}m mode=${travelMode}`,
    );

    const pois = await this.overpass.fetchNearby(origin.lat, origin.lng, radiusMeters, categories);
    const sliced = pois.slice(0, MAX_POIS_PER_REFRESH);

    await this.prisma.developmentNearbyPlace.deleteMany({
      where: {
        developmentId,
        searchRadiusMeters: radiusMeters,
        travelMode,
        source: 'overpass',
      },
    });

    const now = new Date();
    const records = await Promise.all(
      sliced.map(async (p) => {
        const est = await this.routing.estimateRoute(origin, { lat: p.lat, lng: p.lng }, travelMode);
        return {
          developmentId,
          name: p.name,
          category: p.category,
          subcategory: p.subcategory ?? null,
          latitude: p.lat,
          longitude: p.lng,
          shortAddress: p.shortAddress ?? null,
          source: 'overpass',
          sourceOsmId: p.sourceOsmId,
          searchRadiusMeters: radiusMeters,
          distanceMeters: est.distanceMeters,
          travelTimeMinutes: est.travelTimeMinutes,
          travelMode,
          routeSource: est.routeSource,
          fetchedAt: now,
        };
      }),
    );

    if (records.length) {
      await this.prisma.developmentNearbyPlace.createMany({ data: records });
    }

    return {
      message: 'Pontos próximos atualizados.',
      count: sliced.length,
      developmentName: dev.name,
    };
  }
}
