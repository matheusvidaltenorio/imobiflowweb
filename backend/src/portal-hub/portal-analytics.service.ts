import { Injectable } from '@nestjs/common';
import { PortalCode, PortalListingLifecycleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(filters?: { from?: Date; to?: Date; portal?: PortalCode }) {
    const whereListing: { createdAt?: { gte?: Date; lte?: Date }; portal?: PortalCode } = {};
    if (filters?.from || filters?.to) {
      whereListing.createdAt = {};
      if (filters.from) whereListing.createdAt.gte = filters.from;
      if (filters.to) whereListing.createdAt.lte = filters.to;
    }
    if (filters?.portal) whereListing.portal = filters.portal;

    const [total, byStatus, leadsByPortal, matchCount] = await Promise.all([
      this.prisma.portalListing.count({ where: whereListing }),
      this.prisma.portalListing.groupBy({
        by: ['publicationStatus'],
        where: whereListing,
        _count: true,
      }),
      this.prisma.externalPortalLead.groupBy({
        by: ['portal'],
        where: filters?.from || filters?.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : undefined,
        _count: true,
      }),
      this.prisma.matchSuggestion.count(),
    ]);

    return {
      portalListingsTotal: total,
      portalListingsByStatus: Object.fromEntries(byStatus.map((r) => [r.publicationStatus, r._count])),
      externalLeadsByPortal: Object.fromEntries(leadsByPortal.map((r) => [r.portal, r._count])),
      matchSuggestionsTotal: matchCount,
    };
  }

  async failureRateByPortal() {
    const rows = await this.prisma.portalListing.groupBy({
      by: ['portal', 'publicationStatus'],
      _count: true,
    });
    return rows;
  }
}
