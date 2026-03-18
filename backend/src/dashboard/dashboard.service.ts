import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string, role: UserRole) {
    const propertyWhere = role === UserRole.ADMIN ? {} : { userId };

    const [propertiesCount, visitsCount, leadsCount, favoritesCount] = await Promise.all([
      this.prisma.property.count({ where: propertyWhere }),
      this.prisma.visit.count({
        where: role === UserRole.ADMIN ? {} : { userId },
      }),
      this.prisma.lead.count({
        where: {
          property: propertyWhere,
        },
      }),
      role === UserRole.CLIENTE
        ? this.prisma.favorite.count({ where: { userId } })
        : 0,
    ]);

    const recentLeads = await this.prisma.lead.findMany({
      where: { property: propertyWhere },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { title: true } } },
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

    return {
      propertiesCount,
      visitsCount,
      leadsCount,
      favoritesCount,
      recentLeads,
      propertiesByType: propertiesByType.map((p) => ({ type: p.type, count: p._count })),
      propertiesByStatus: propertiesByStatus.map((p) => ({ status: p.status, count: p._count })),
    };
  }
}
