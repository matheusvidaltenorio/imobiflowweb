import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  LeadStatus,
  Prisma,
  PropertyStatus,
  UserRole,
  VisitStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { calculateLotSaleScore, commercialTags, type LotScoreInput } from '../lot-scoring/lot-score.engine';
import { calculateClosingPrediction, closingScoreTrend } from './closing-prediction.engine';

@Injectable()
export class ClosingPredictionService {
  private readonly logger = new Logger(ClosingPredictionService.name);

  constructor(private prisma: PrismaService) {}

  private toLotInput(row: {
    price: Prisma.Decimal | null;
    area: Prisma.Decimal | null;
    viewCount: number;
    contactCount: number;
    scheduledVisitsCount: number;
    proposalsCount: number;
    manualHighlight: boolean;
    availableSince: Date | null;
    createdAt: Date;
  }): LotScoreInput {
    return {
      price: row.price != null ? Number(row.price) : null,
      area: row.area != null ? Number(row.area) : null,
      viewCount: row.viewCount,
      contactCount: row.contactCount,
      scheduledVisitsCount: row.scheduledVisitsCount,
      proposalsCount: row.proposalsCount,
      manualHighlight: row.manualHighlight,
      availableSince: row.availableSince,
      createdAt: row.createdAt,
    };
  }

  private async financialFit(lead: {
    clientId: string | null;
  }): Promise<'good' | 'bad' | 'unknown'> {
    if (!lead.clientId) return 'unknown';
    const sim = await this.prisma.simulation.findFirst({
      where: { clientId: lead.clientId },
      orderBy: { createdAt: 'desc' },
    });
    if (!sim) return 'unknown';
    const inc = Number(sim.income);
    if (inc <= 0) return 'unknown';
    const fin = Number(sim.financedAmount);
    const estMonthly = fin > 0 ? (fin * 0.0075) : 0;
    let fit: 'good' | 'bad' | 'unknown' = 'unknown';
    const r0 = estMonthly / inc;
    if (r0 <= 0.28) fit = 'good';
    else if (r0 > 0.38) fit = 'bad';

    const prop = await this.prisma.proposal.findFirst({
      where: { clientId: lead.clientId },
      orderBy: { createdAt: 'desc' },
    });
    if (prop) {
      const inst = Number(prop.installment);
      const r1 = inst / inc;
      if (r1 > 0.35) return 'bad';
      if (r1 <= 0.28) return 'good';
    }
    return fit;
  }

  /** Recalcula e persiste previsão + snapshot (não bloqueia resposta HTTP se chamado sem await em hooks). */
  async recalculateLead(leadId: string): Promise<void> {
    try {
      await this.recalculateLeadInternal(leadId);
    } catch (e) {
      this.logger.warn(`Falha ao recalcular lead ${leadId}: ${e}`);
    }
  }

  private async recalculateLeadInternal(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        interactions: { orderBy: { createdAt: 'desc' } },
        visits: true,
        lot: { include: { block: { include: { development: true } } } },
      },
    });
    if (!lead) return;

    const lastInteractionAt =
      lead.interactions[0]?.createdAt ??
      lead.visits[0]?.updatedAt ??
      lead.createdAt;

    const now = Date.now();
    const daysSinceLastInteraction = Math.max(
      0,
      Math.floor((now - new Date(lastInteractionAt).getTime()) / 86400000),
    );
    const daysInPipeline = Math.max(
      0,
      Math.floor((now - new Date(lead.createdAt).getTime()) / 86400000),
    );

    const responseCount = lead.interactions.filter(
      (i) => !i.userId || i.type === 'VISITA_PAGINA' || i.type === 'CRIACAO',
    ).length;

    const visitCompleted = lead.visits.some((v) => v.status === VisitStatus.REALIZADA);
    const visitScheduledFuture = lead.visits.some(
      (v) =>
        v.status === VisitStatus.AGENDADA && new Date(v.scheduledAt).getTime() > now,
    );

    let proposalCount = 0;
    if (lead.clientId) {
      proposalCount = await this.prisma.proposal.count({
        where: { clientId: lead.clientId },
      });
    }

    const financialFit = await this.financialFit(lead);

    let lotSaleScore: number | null = null;
    let lotTags: string[] = [];
    let lotBelowMedian = false;
    if (lead.lot && lead.lot.status === PropertyStatus.DISPONIVEL) {
      const devId = lead.lot.block.developmentId;
      const cohortRows = await this.prisma.lot.findMany({
        where: { status: PropertyStatus.DISPONIVEL, block: { developmentId: devId } },
      });
      const cohortInputs = cohortRows.map((r) => this.toLotInput(r));
      const selfInput = this.toLotInput(lead.lot);
      const res = calculateLotSaleScore(selfInput, cohortInputs);
      lotSaleScore = res.score;
      lotTags = commercialTags(res.score, selfInput, cohortInputs);
      const prices = cohortInputs.map((x) => x.price).filter((p): p is number => p != null && p > 0);
      const sorted = [...prices].sort((a, b) => a - b);
      const med =
        sorted.length === 0
          ? null
          : sorted.length % 2 === 1
            ? sorted[(sorted.length - 1) / 2]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      const p = lead.lot.price != null ? Number(lead.lot.price) : null;
      lotBelowMedian = p != null && med != null && med > 0 && p <= med * 0.92;
    }

    const result = calculateClosingPrediction({
      status: lead.status,
      isHot: lead.isHot,
      interactionCount: lead.interactionCount,
      responseCount,
      daysSinceLastInteraction,
      daysInPipeline,
      visitCompleted,
      visitScheduledFuture,
      proposalCount,
      financialFit,
      lotSaleScore,
      lotTags,
      lotBelowMedian,
    });

    const prevScore = lead.closingScore != null ? Number(lead.closingScore) : null;
    const trend = closingScoreTrend(prevScore, result.score);

    await this.prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          leadLastInteractionAt: lastInteractionAt,
          previousClosingScore: lead.closingScore,
          closingScore: new Decimal(result.score),
          closingPrediction: result.classification,
          closingReason: result.reason,
          closingInterestLevel: result.interestLevel,
          closingPriorityLevel: result.priorityLevel,
          closingNextAction: result.nextAction,
          closingPositiveFactors: result.positiveFactors as unknown as Prisma.InputJsonValue,
          closingRiskFactors: result.riskFactors as unknown as Prisma.InputJsonValue,
          closingScoreUpdatedAt: new Date(),
        },
      });

      await tx.leadPredictionSnapshot.create({
        data: {
          leadId,
          closingScore: new Decimal(result.score),
          closingPrediction: result.classification,
          closingReason: result.reason,
          nextRecommendedAction: result.nextAction,
          previousScore: prevScore != null ? new Decimal(prevScore) : null,
          factorsJson: {
            subscores: result.subscores,
            positiveFactors: result.positiveFactors,
            riskFactors: result.riskFactors,
            trend,
            daysSinceLastInteraction,
            proposalCount,
            visitCompleted,
            visitScheduledFuture,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    const excess = await this.prisma.leadPredictionSnapshot.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      skip: 45,
      select: { id: true },
    });
    if (excess.length) {
      await this.prisma.leadPredictionSnapshot.deleteMany({
        where: { id: { in: excess.map((e: { id: string }) => e.id) } },
      });
    }
  }

  async recalculateForClientLeads(clientId: string | null | undefined): Promise<void> {
    if (!clientId) return;
    const leads = await this.prisma.lead.findMany({
      where: { clientId },
      select: { id: true },
    });
    for (const l of leads) {
      await this.recalculateLead(l.id);
    }
  }

  async recalculateForLotLeads(lotId: string): Promise<void> {
    const leads = await this.prisma.lead.findMany({
      where: { lotId },
      select: { id: true },
    });
    for (const l of leads) {
      await this.recalculateLead(l.id);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledRecalculateAll(): Promise<void> {
    try {
      const leads = await this.prisma.lead.findMany({
        where: { status: { notIn: [LeadStatus.VENDIDO, LeadStatus.PERDIDO] } },
        select: { id: true },
      });
      for (const l of leads) {
        await this.recalculateLeadInternal(l.id);
      }
      this.logger.debug(`Previsão de fechamento: ${leads.length} lead(s) recalculados`);
    } catch (e) {
      this.logger.warn(`Cron previsão: ${e}`);
    }
  }

  async getHistory(leadId: string, userId: string, role: UserRole) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        property: { select: { userId: true } },
        lot: { include: { block: true } },
      },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (!(await this.canAccessLead(lead, userId, role))) {
      throw new ForbiddenException('Sem permissão');
    }
    return this.prisma.leadPredictionSnapshot.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  }

  private async canAccessLead(
    lead: { property?: { userId: string } | null; lot?: { block: { developmentId: string } } | null },
    userId: string,
    role: UserRole,
  ): Promise<boolean> {
    if (role === UserRole.ADMIN) return true;
    if (lead.property && lead.property.userId === userId) return true;
    if (lead.lot) {
      const p = await this.prisma.property.findFirst({
        where: { userId, developmentId: lead.lot.block.developmentId },
      });
      return !!p;
    }
    return false;
  }

  async getDashboardClosing(userId: string, role: UserRole) {
    if (role === UserRole.CLIENTE) {
      return {
        topToCloseToday: [],
        coolingDown: [],
        needsFollowUp: [],
        nearClosing: [],
      };
    }

    const baseWhere = await this.leadWhereForBroker(userId, role);
    const activeWhere: Prisma.LeadWhereInput = {
      AND: [
        baseWhere,
        { status: { notIn: [LeadStatus.VENDIDO, LeadStatus.PERDIDO] } },
        { closingScore: { not: null } },
      ],
    };

    const topToCloseToday = await this.prisma.lead.findMany({
      where: activeWhere,
      orderBy: { closingScore: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        closingScore: true,
        closingPrediction: true,
        closingNextAction: true,
        closingPriorityLevel: true,
        lot: {
          select: {
            number: true,
            block: { select: { name: true, development: { select: { name: true } } } },
          },
        },
      },
    });

    const needsFollowUp = await this.prisma.lead.findMany({
      where: {
        AND: [
          activeWhere,
          {
            OR: [
              { leadLastInteractionAt: { lt: new Date(Date.now() - 7 * 86400000) } },
              { closingPriorityLevel: 'ALTA', leadLastInteractionAt: { lt: new Date(Date.now() - 3 * 86400000) } },
            ],
          },
        ],
      },
      orderBy: { leadLastInteractionAt: 'asc' },
      take: 6,
      select: {
        id: true,
        name: true,
        closingScore: true,
        closingPrediction: true,
        closingNextAction: true,
        leadLastInteractionAt: true,
        lot: {
          select: {
            number: true,
            block: { select: { name: true, development: { select: { name: true } } } },
          },
        },
      },
    });

    const nearClosing = await this.prisma.lead.findMany({
      where: {
        AND: [activeWhere, { closingScore: { gte: 70 } }],
      },
      orderBy: { closingScore: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        closingScore: true,
        closingPrediction: true,
        status: true,
        lot: {
          select: {
            number: true,
            block: { select: { name: true, development: { select: { name: true } } } },
          },
        },
      },
    });

    const activeIds = (
      await this.prisma.lead.findMany({
        where: activeWhere,
        select: { id: true },
      })
    ).map((l) => l.id);

    const recentSnapshots = activeIds.length
      ? await this.prisma.leadPredictionSnapshot.findMany({
          where: {
            leadId: { in: activeIds },
            previousScore: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 120,
          select: {
            leadId: true,
            closingScore: true,
            previousScore: true,
            createdAt: true,
            lead: {
              select: {
                id: true,
                name: true,
                closingPrediction: true,
                lot: {
                  select: {
                    number: true,
                    block: { select: { development: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        })
      : [];

    const coolingMap = new Map<
      string,
      { lead: (typeof recentSnapshots)[0]['lead']; drop: number }
    >();
    for (const s of recentSnapshots) {
      const cur = Number(s.closingScore);
      const prev = Number(s.previousScore);
      if (prev - cur >= 12 && !coolingMap.has(s.leadId)) {
        coolingMap.set(s.leadId, { lead: s.lead, drop: prev - cur });
      }
    }
    const coolingDown = [...coolingMap.values()].slice(0, 6).map((x) => ({
      ...x.lead,
      momentumDrop: Math.round(x.drop),
    }));

    return {
      topToCloseToday: topToCloseToday.map((l) => ({
        ...l,
        closingScore: l.closingScore != null ? Number(l.closingScore) : null,
        lotLabel: l.lot
          ? `Lote ${l.lot.number} · ${l.lot.block?.development?.name ?? ''}`
          : null,
      })),
      needsFollowUp: needsFollowUp.map((l) => ({
        ...l,
        closingScore: l.closingScore != null ? Number(l.closingScore) : null,
        lotLabel: l.lot
          ? `Lote ${l.lot.number} · ${l.lot.block?.development?.name ?? ''}`
          : null,
      })),
      nearClosing: nearClosing.map((l) => ({
        ...l,
        closingScore: l.closingScore != null ? Number(l.closingScore) : null,
        lotLabel: l.lot
          ? `Lote ${l.lot.number} · ${l.lot.block?.development?.name ?? ''}`
          : null,
      })),
      coolingDown,
    };
  }

  private async leadWhereForBroker(userId: string, role: UserRole): Promise<Prisma.LeadWhereInput> {
    if (role === UserRole.CLIENTE) return { id: { in: [] } };
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
    if (propertyIds.length) or.push({ propertyId: { in: propertyIds } });
    if (role === UserRole.ADMIN) {
      or.push({ lotId: { not: null } });
    } else if (devIds.length) {
      or.push({ lot: { block: { developmentId: { in: devIds } } } });
    }
    if (!or.length) return { id: { in: [] } };
    return { OR: or };
  }
}
