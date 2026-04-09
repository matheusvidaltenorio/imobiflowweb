import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Leituras agregadas para mapa / dashboard (sem acoplar ao LotsService).
 * O payload GeoJSON por empreendimento continua em `LotsService.findMapByDevelopment`.
 */
@Injectable()
export class MapDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMapMetrics(): Promise<{
    developmentsWithCoords: number;
    developmentsWithPolygon: number;
    developmentsPendingGeo: number;
    nearbyPlacesCount: number;
  }> {
    const [developmentsWithCoords, developmentsPendingGeo, nearbyPlacesCount, polygonCountRow] =
      await Promise.all([
        this.prisma.development.count({
          where: { AND: [{ latitude: { not: null } }, { longitude: { not: null } }] },
        }),
        this.prisma.development.count({ where: { geocodingStatus: 'PENDING' } }),
        this.prisma.developmentNearbyPlace.count(),
        this.prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT COUNT(*)::bigint AS n FROM "Development" WHERE "polygonCoordinates" IS NOT NULL
        `,
      ]);
    return {
      developmentsWithCoords,
      developmentsWithPolygon: Number(polygonCountRow[0]?.n ?? 0),
      developmentsPendingGeo,
      nearbyPlacesCount,
    };
  }
}
