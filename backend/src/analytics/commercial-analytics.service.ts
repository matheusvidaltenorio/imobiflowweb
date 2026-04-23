import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  LeadStatus,
  MarketingCampaignStatus,
  Prisma,
  UserRole,
  VisitStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const FUNNEL_STAGES: LeadStatus[] = [
  'NOVO_LEAD',
  'EM_ATENDIMENTO',
  'VISITA_AGENDADA',
  'PROPOSTA_ENVIADA',
  'RESERVADO',
  'VENDIDO',
  'PERDIDO',
];

const STALE_DAYS = 7;

export type CommercialAnalyticsResult = {
  meta: {
    generatedAt: string;
    range: { from: string; to: string };
    funnelNote: string;
  };
  kpis: {
    leadsTotal: number;
    leadsWithVisit: number;
    leadsWon: number;
    leadsLost: number;
    visitsScheduled: number;
    visitsDone: number;
    visitsCanceled: number;
    proposalsTotal: number;
    salesTotal: number;
    lotsReserved: number;
    lotsSold: number;
    lotsAvailable: number;
    leadToVisitRate: number;
    leadToSaleRate: number;
    lossRate: number;
  };
  funnel: Array<{ stage: LeadStatus; count: number; percent: number }>;
  leadsBySource: Array<{ source: string; count: number }>;
  leadsSeries: Array<{ date: string; count: number }>;
  topBrokers: Array<{ userId: string; name: string; leads: number; visits: number; sales: number }>;
  topDevelopments: Array<{
    developmentId: string;
    name: string;
    city: string | null;
    leads: number;
    lotsAvailable: number;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    status: MarketingCampaignStatus;
    publishedAt: string | null;
    leadsCount: number;
    visitsFromLeads: number;
  }>;
  operational: {
    leadsNewToday: number;
    leadsWithoutInteraction: number;
    leadsStale: number;
    visitsToday: number;
    visitsThisWeek: number;
    campaignsFailedRecent: number;
  };
};

@Injectable()
export class CommercialAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mesma regra de escopo do dashboard (leads visíveis ao corretor). */
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

  private parseRange(from?: string, to?: string): { start: Date; end: Date } {
    const end = to?.trim() ? new Date(to) : new Date();
    let start = from?.trim() ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(end.getTime())) {
      const n = new Date();
      n.setHours(23, 59, 59, 999);
      return { start: new Date(n.getTime() - 30 * 24 * 60 * 60 * 1000), end: n };
    }
    if (Number.isNaN(start.getTime())) {
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private async buildLeadWhere(
    userId: string,
    role: UserRole,
    range: { start: Date; end: Date },
    filters: {
      developmentId?: string;
      brokerId?: string;
      campaignId?: string;
      leadSource?: string;
    },
  ): Promise<Prisma.LeadWhereInput> {
    const base = await this.leadWhereForBroker(userId, role);
    const parts: Prisma.LeadWhereInput[] = [base];

    if (filters.brokerId?.trim() && role === UserRole.ADMIN) {
      parts.push({ userId: filters.brokerId.trim() });
    }

    if (filters.developmentId?.trim()) {
      const d = filters.developmentId.trim();
      parts.push({
        OR: [{ developmentId: d }, { lot: { block: { developmentId: d } } }],
      });
    }

    if (filters.campaignId?.trim()) {
      parts.push({ marketingCampaign: { id: filters.campaignId.trim() } });
    }

    if (filters.leadSource?.trim()) {
      const s = filters.leadSource.trim();
      parts.push({ OR: [{ leadSource: s }, { source: s }] });
    }

    parts.push({ createdAt: { gte: range.start, lte: range.end } });

    return { AND: parts };
  }

  private visitWhere(
    userId: string,
    role: UserRole,
    range: { start: Date; end: Date },
    brokerId?: string,
  ): Prisma.VisitWhereInput {
    const scheduled = { scheduledAt: { gte: range.start, lte: range.end } };
    if (role === UserRole.ADMIN) {
      if (brokerId?.trim()) {
        return { userId: brokerId.trim(), ...scheduled };
      }
      return scheduled;
    }
    return { userId, ...scheduled };
  }

  private saleWhere(
    userId: string,
    role: UserRole,
    range: { start: Date; end: Date },
    brokerId?: string,
  ): Prisma.SaleWhereInput {
    if (role === UserRole.ADMIN && brokerId?.trim()) {
      return { userId: brokerId.trim(), soldAt: { gte: range.start, lte: range.end } };
    }
    if (role === UserRole.CORRETOR) {
      return { userId, soldAt: { gte: range.start, lte: range.end } };
    }
    return { soldAt: { gte: range.start, lte: range.end } };
  }

  private proposalWhere(
    userId: string,
    role: UserRole,
    range: { start: Date; end: Date },
    brokerId?: string,
  ): Prisma.ProposalWhereInput {
    if (role === UserRole.ADMIN && brokerId?.trim()) {
      return { userId: brokerId.trim(), createdAt: { gte: range.start, lte: range.end } };
    }
    if (role === UserRole.CORRETOR) {
      return { userId, createdAt: { gte: range.start, lte: range.end } };
    }
    return { createdAt: { gte: range.start, lte: range.end } };
  }

  async getCommercialDashboard(
    userId: string,
    role: UserRole,
    query: {
      from?: string;
      to?: string;
      developmentId?: string;
      brokerId?: string;
      campaignId?: string;
      leadSource?: string;
    },
  ): Promise<CommercialAnalyticsResult> {
    if (role === UserRole.CLIENTE) {
      throw new ForbiddenException('Sem permissão para analytics comercial.');
    }

    if (role === UserRole.CORRETOR && query.brokerId && query.brokerId !== userId) {
      throw new ForbiddenException('Corretor só pode ver os próprios dados.');
    }

    const range = this.parseRange(query.from, query.to);
    const leadWhere = await this.buildLeadWhere(userId, role, range, query);
    const visitWhereScoped = this.visitWhere(userId, role, range, query.brokerId);
    const saleWhereScoped = this.saleWhere(userId, role, range, query.brokerId);
    const proposalWhereScoped = this.proposalWhere(userId, role, range, query.brokerId);

    const [
      leadsTotal,
      leadsByStatus,
      leadsWithVisit,
      leadsWon,
      leadsLost,
      visitsScheduled,
      visitsDone,
      visitsCanceled,
      proposalsTotal,
      salesTotal,
      sourceGroups,
      leadRowsForSeries,
      brokersRaw,
      developmentsRaw,
      campaignsRaw,
      lotsGroup,
      leadsNoInteraction,
      leadsStale,
      visitsToday,
      visitsWeek,
      campaignsFailed,
    ] = await Promise.all([
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: leadWhere,
        _count: true,
      }),
      this.prisma.lead.count({
        where: {
          AND: [leadWhere, { visits: { some: {} } }],
        },
      }),
      this.prisma.lead.count({
        where: { AND: [leadWhere, { status: 'VENDIDO' }] },
      }),
      this.prisma.lead.count({
        where: { AND: [leadWhere, { status: 'PERDIDO' }] },
      }),
      this.prisma.visit.count({
        where: {
          ...visitWhereScoped,
          status: { in: [VisitStatus.AGENDADA, VisitStatus.REMARCADA] },
        },
      }),
      this.prisma.visit.count({
        where: { ...visitWhereScoped, status: VisitStatus.REALIZADA },
      }),
      this.prisma.visit.count({
        where: { ...visitWhereScoped, status: VisitStatus.CANCELADA },
      }),
      this.prisma.proposal.count({ where: proposalWhereScoped }),
      this.prisma.sale.count({ where: saleWhereScoped }),
      this.prisma.lead.groupBy({
        by: ['leadSource'],
        where: leadWhere,
        _count: true,
      }),
      this.prisma.lead.findMany({
        where: leadWhere,
        select: { createdAt: true },
      }),
      this.prisma.lead.groupBy({
        by: ['userId'],
        where: { AND: [leadWhere, { userId: { not: null } }] },
        _count: true,
      }),
      this.prisma.lead.groupBy({
        by: ['developmentId'],
        where: { AND: [leadWhere, { developmentId: { not: null } }] },
        _count: true,
      }),
      this.prisma.marketingCampaign.findMany({
        where: {
          createdAt: { lte: range.end },
          ...(role === UserRole.CORRETOR ? { userId } : {}),
          ...(role === UserRole.ADMIN && query.brokerId?.trim() ? { userId: query.brokerId.trim() } : {}),
        },
        select: {
          id: true,
          title: true,
          status: true,
          campaignPublishedAt: true,
          userId: true,
        },
        take: 40,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.lot.groupBy({
        by: ['status'],
        where: query.developmentId?.trim()
          ? { block: { developmentId: query.developmentId.trim() } }
          : {},
        _count: true,
      }),
      this.prisma.lead.count({
        where: {
          AND: [
            leadWhere,
            { interactionCount: 0 },
          ],
        },
      }),
      this.prisma.lead.count({
        where: {
          AND: [
            leadWhere,
            { status: { notIn: ['VENDIDO', 'PERDIDO'] } },
            {
              OR: [
                {
                  leadLastInteractionAt: {
                    lt: new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000),
                  },
                },
                {
                  AND: [
                    { leadLastInteractionAt: null },
                    { createdAt: { lt: new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000) } },
                  ],
                },
              ],
            },
          ],
        },
      }),
      this.prisma.visit.count({
        where: this.visitWhere(
          userId,
          role,
          (() => {
            const a = new Date();
            const start = new Date(a);
            start.setHours(0, 0, 0, 0);
            const end = new Date(a);
            end.setHours(23, 59, 59, 999);
            return { start, end };
          })(),
          query.brokerId,
        ),
      }),
      this.prisma.visit.count({
        where: this.visitWhere(
          userId,
          role,
          {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date(),
          },
          query.brokerId,
        ),
      }),
      this.prisma.marketingCampaign.count({
        where: {
          status: MarketingCampaignStatus.FAILED,
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          ...(role === UserRole.CORRETOR ? { userId } : {}),
          ...(role === UserRole.ADMIN && query.brokerId?.trim() ? { userId: query.brokerId.trim() } : {}),
        },
      }),
    ]);

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);
    const todayLeadWhere = await this.buildLeadWhere(
      userId,
      role,
      { start: startToday, end: endToday },
      query,
    );
    const leadsNewToday = await this.prisma.lead.count({ where: todayLeadWhere });

    const statusMap = Object.fromEntries(leadsByStatus.map((r) => [r.status, r._count])) as Partial<
      Record<LeadStatus, number>
    >;

    const funnel = FUNNEL_STAGES.map((stage) => {
      const count = statusMap[stage] ?? 0;
      const percent =
        leadsTotal > 0 ? Math.round((count / leadsTotal) * 1000) / 10 : 0;
      return { stage, count, percent };
    });

    const byDay = new Map<string, number>();
    for (const r of leadRowsForSeries) {
      const key = r.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const leadsSeries = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const leadToVisitRate =
      leadsTotal > 0 ? Math.round((leadsWithVisit / leadsTotal) * 1000) / 10 : 0;
    const leadToSaleRate =
      leadsTotal > 0 ? Math.round((leadsWon / leadsTotal) * 1000) / 10 : 0;
    const lossRate =
      leadsTotal > 0 ? Math.round((leadsLost / leadsTotal) * 1000) / 10 : 0;

    const leadsBySource = sourceGroups.map((g) => ({
      source: g.leadSource?.trim() || 'Não informado',
      count: g._count,
    }));

    const brokerIds = brokersRaw.map((b) => b.userId).filter((id): id is string => !!id);
    const users = await this.prisma.user.findMany({
      where: { id: { in: brokerIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const visitMap: Record<string, number> = {};
    const saleMap: Record<string, number> = {};
    if (brokerIds.length) {
      const [visitGroups, saleGroups] = await Promise.all([
        this.prisma.visit.groupBy({
          by: ['userId'],
          where: {
            userId: { in: brokerIds },
            scheduledAt: { gte: range.start, lte: range.end },
          },
          _count: true,
        }),
        this.prisma.sale.groupBy({
          by: ['userId'],
          where: {
            userId: { in: brokerIds },
            soldAt: { gte: range.start, lte: range.end },
          },
          _count: true,
        }),
      ]);
      for (const g of visitGroups) visitMap[g.userId] = g._count;
      for (const g of saleGroups) saleMap[g.userId] = g._count;
    }

    const topBrokers = brokersRaw
      .map((b) => ({
        userId: b.userId!,
        name: userMap[b.userId!] ?? b.userId!,
        leads: b._count,
        visits: visitMap[b.userId!] ?? 0,
        sales: saleMap[b.userId!] ?? 0,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);

    const devIds = developmentsRaw.map((d) => d.developmentId).filter((id): id is string => !!id);
    const devs = await this.prisma.development.findMany({
      where: { id: { in: devIds } },
      select: { id: true, name: true, city: true },
    });
    const devMap = Object.fromEntries(devs.map((d) => [d.id, d]));

    const devTopSlice = developmentsRaw.slice(0, 10);
    const devIdsTop = devTopSlice.map((d) => d.developmentId).filter((id): id is string => !!id);
    const lotsAvailByDev: Record<string, number> = {};
    if (devIdsTop.length) {
      const availRows = await this.prisma.$queryRaw<Array<{ did: string; cnt: bigint }>>(
        Prisma.sql`
          SELECT b."developmentId" AS did, COUNT(lot.id)::bigint AS cnt
          FROM "Lot" lot
          INNER JOIN "Block" b ON b.id = lot."blockId"
          WHERE b."developmentId" IN (${Prisma.join(devIdsTop)})
            AND lot.status = ${'DISPONIVEL'}::"PropertyStatus"
          GROUP BY b."developmentId"
        `,
      );
      for (const r of availRows) {
        lotsAvailByDev[r.did] = Number(r.cnt);
      }
    }

    const topDevelopments = devTopSlice
      .map((d) => {
        const meta = devMap[d.developmentId!];
        return {
          developmentId: d.developmentId!,
          name: meta?.name ?? '—',
          city: meta?.city ?? null,
          leads: d._count,
          lotsAvailable: lotsAvailByDev[d.developmentId!] ?? 0,
        };
      })
      .sort((a, b) => b.leads - a.leads);

    const lotsStatusMap = Object.fromEntries(lotsGroup.map((r) => [r.status, r._count])) as Record<
      string,
      number
    >;

    const campaignIds = campaignsRaw.map((c) => c.id);
    const leadCountByCampaign: Record<string, number> = {};
    const visitCountByCampaign: Record<string, number> = {};

    if (campaignIds.length) {
      const [leadGroups, visitRows] = await Promise.all([
        this.prisma.lead.groupBy({
          by: ['marketingCampaignId'],
          where: { marketingCampaignId: { in: campaignIds } },
          _count: true,
        }),
        this.prisma.$queryRaw<Array<{ cid: string; cnt: bigint }>>(
          Prisma.sql`
            SELECT l.marketing_campaign_id AS cid, COUNT(v.id)::bigint AS cnt
            FROM "Visit" v
            INNER JOIN "Lead" l ON l.id = v."leadId"
            WHERE l.marketing_campaign_id IN (${Prisma.join(campaignIds)})
              AND v."scheduledAt" >= ${range.start}
              AND v."scheduledAt" <= ${range.end}
            GROUP BY l.marketing_campaign_id
          `,
        ),
      ]);
      for (const g of leadGroups) {
        if (g.marketingCampaignId) {
          leadCountByCampaign[g.marketingCampaignId] = g._count;
        }
      }
      for (const r of visitRows) {
        visitCountByCampaign[r.cid] = Number(r.cnt);
      }
    }

    const campaignMetrics = campaignsRaw
      .map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        publishedAt: c.campaignPublishedAt?.toISOString() ?? null,
        leadsCount: leadCountByCampaign[c.id] ?? 0,
        visitsFromLeads: visitCountByCampaign[c.id] ?? 0,
      }))
      .sort((a, b) => b.leadsCount - a.leadsCount);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        range: { from: range.start.toISOString(), to: range.end.toISOString() },
        funnelNote:
          'Funil: leads criados no período, agrupados pelo status atual (snapshot). Útil para ver onde está o estoque de oportunidades.',
      },
      kpis: {
        leadsTotal,
        leadsWithVisit,
        leadsWon,
        leadsLost,
        visitsScheduled,
        visitsDone,
        visitsCanceled,
        proposalsTotal,
        salesTotal,
        lotsReserved: lotsStatusMap['RESERVADO'] ?? 0,
        lotsSold: lotsStatusMap['VENDIDO'] ?? 0,
        lotsAvailable: lotsStatusMap['DISPONIVEL'] ?? 0,
        leadToVisitRate,
        leadToSaleRate,
        lossRate,
      },
      funnel,
      leadsBySource,
      leadsSeries,
      topBrokers,
      topDevelopments,
      campaigns: campaignMetrics,
      operational: {
        leadsNewToday,
        leadsWithoutInteraction: leadsNoInteraction,
        leadsStale,
        visitsToday,
        visitsThisWeek: visitsWeek,
        campaignsFailedRecent: campaignsFailed,
      },
    };
  }
}
