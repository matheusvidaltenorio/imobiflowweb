import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, Prisma } from '@prisma/client';
import { LotScoringService } from '../lot-scoring/lot-scoring.service';
import { CommercialAssistantService } from '../commercial-assistant/commercial-assistant.service';
import { ClosingPredictionService } from '../closing-prediction/closing-prediction.service';
import { InstagramAdsService } from '../instagram-ads/instagram-ads.service';
import { MapDataService } from '../maps/map-data.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private scoring: LotScoringService,
    private commercialAssistant: CommercialAssistantService,
    private closingPrediction: ClosingPredictionService,
    private instagramAds: InstagramAdsService,
    private mapData: MapDataService,
  ) {}

  private async leadWhereForBroker(userId: string, role: UserRole): Promise<Prisma.LeadWhereInput> {
    if (role === UserRole.CLIENTE) {
      return { id: { in: [] } };
    }
    const propertyRows = await this.prisma.property.findMany({
      where: role === UserRole.ADMIN ? {} : { userId },
      select: { id: true },
    });
    const propertyIds = propertyRows.map((p) => p.id);

    const devRows = await this.prisma.property.findMany({
      where: role === UserRole.ADMIN ? {} : { userId, developmentId: { not: null } },
      select: { developmentId: true },
      distinct: ['developmentId'],
    });
    const devIds = devRows.map((r) => r.developmentId).filter((id): id is string => !!id);

    const or: Prisma.LeadWhereInput[] = [];
    if (propertyIds.length) {
      or.push({ propertyId: { in: propertyIds } });
    }
    if (role === UserRole.ADMIN) {
      or.push({ lotId: { not: null } });
    } else if (devIds.length) {
      or.push({
        lot: { block: { developmentId: { in: devIds } } },
      });
    }

    if (!or.length) {
      return { id: { in: [] } };
    }
    return { OR: or };
  }

  async getStats(userId: string, role: UserRole) {
    const propertyWhere = role === UserRole.ADMIN ? {} : { userId };
    const clientWhere = role === UserRole.ADMIN ? {} : { brokerId: userId };
    const leadWhere = await this.leadWhereForBroker(userId, role);

    const [
      propertiesCount,
      visitsCount,
      leadsCount,
      favoritesCount,
      developmentsCount,
      blocksCount,
      lotsCount,
      clientsCount,
      lotsByStatus,
      leadsByStage,
      leadsSold,
      leadsTotalForConversion,
    ] = await Promise.all([
      this.prisma.property.count({ where: propertyWhere }),
      this.prisma.visit.count({
        where: role === UserRole.ADMIN ? {} : { userId },
      }),
      this.prisma.lead.count({ where: leadWhere }),
      role === UserRole.CLIENTE
        ? this.prisma.favorite.count({ where: { userId } })
        : 0,
      this.prisma.development.count(),
      this.prisma.block.count(),
      this.prisma.lot.count(),
      role === UserRole.CLIENTE ? 0 : this.prisma.client.count({ where: clientWhere }),
      this.prisma.lot.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: leadWhere,
        _count: true,
      }),
      this.prisma.lead.count({
        where: { AND: [leadWhere, { status: 'VENDIDO' }] },
      }),
      this.prisma.lead.count({
        where: {
          AND: [
            leadWhere,
            { status: { in: ['VENDIDO', 'PERDIDO', 'NEGOCIACAO', 'QUALIFICACAO', 'PROSPECCAO'] } },
          ],
        },
      }),
    ]);

    const recentLeads = await this.prisma.lead.findMany({
      where: leadWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { title: true } },
        lot: {
          select: {
            number: true,
            block: { select: { name: true, development: { select: { name: true } } } },
          },
        },
      },
    });

    const propertiesByType = await this.prisma.property.groupBy({
      by: ['type'],
      where: propertyWhere,
      _count: true,
    });

    const propertiesByStatus = await this.prisma.property.groupBy({
      by: ['status'],
      where: propertyWhere,
      _count: true,
    });

    const lotsStatusMap = Object.fromEntries(
      lotsByStatus.map((row) => [row.status, row._count]),
    ) as Record<string, number>;

    const conversionRate =
      leadsTotalForConversion > 0
        ? Math.round((leadsSold / leadsTotalForConversion) * 1000) / 10
        : 0;

    const commercialIntel = await this.scoring.getCommercialDashboard(userId, role);
    const messageRecommendations = await this.commercialAssistant.dashboardMessageRecommendations(
      userId,
      role,
    );
    const closingForecast = await this.closingPrediction.getDashboardClosing(userId, role);
    const instagramAdRecommendations = await this.instagramAds.getDashboardRecommendations(
      userId,
      role,
    );

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
    const developmentsWithPolygon = Number(polygonCountRow[0]?.n ?? 0);

    const mapInsights = {
      developmentsWithCoords,
      developmentsWithPolygon,
      developmentsPendingGeo,
      nearbyPlacesCount,
    };

    return {
      propertiesCount,
      visitsCount,
      leadsCount,
      favoritesCount,
      developmentsCount,
      blocksCount,
      lotsCount,
      clientsCount,
      lotsAvailable: lotsStatusMap['DISPONIVEL'] ?? 0,
      lotsReserved: lotsStatusMap['RESERVADO'] ?? 0,
      lotsSold: lotsStatusMap['VENDIDO'] ?? 0,
      lotsUnavailable: lotsStatusMap['INDISPONIVEL'] ?? 0,
      leadsByStage: leadsByStage.map((r) => ({ status: r.status, count: r._count })),
      leadsSoldCount: leadsSold,
      conversionRate,
      recentLeads,
      propertiesByType: propertiesByType.map((p) => ({ type: p.type, count: p._count })),
      propertiesByStatus: propertiesByStatus.map((p) => ({ status: p.status, count: p._count })),
      commercialIntel,
      messageRecommendations,
      closingForecast,
      instagramAdRecommendations,
      mapInsights,
    };
  }
}
