import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  AiSuggestionMessageType,
  AiSuggestionTone,
  LeadStatus,
  PropertyStatus,
  UserRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateLotSaleScore,
  commercialTags,
  type LotScoreInput,
} from '../lot-scoring/lot-score.engine';
import { closingScoreTrend } from '../closing-prediction/closing-prediction.engine';
import { composeLeadMessages, composeLotPitch } from './commercial-message.composer';
import type { CommercialMessageContext, LeadMessageBundle, LotPitchBundle } from './commercial-assistant.types';

@Injectable()
export class CommercialAssistantService {
  constructor(private prisma: PrismaService) {}

  private formatBrl(n: number | null | undefined): string {
    if (n == null || Number.isNaN(Number(n))) return 'valor sob consulta';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(Number(n));
  }

  private formatArea(n: number | null | undefined): string {
    if (n == null || Number.isNaN(Number(n))) return 'metragem sob consulta';
    return `${Number(n)} m²`;
  }

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
    if (propertyIds.length) or.push({ propertyId: { in: propertyIds } });
    if (role === UserRole.ADMIN) {
      or.push({ lotId: { not: null } });
    } else if (devIds.length) {
      or.push({ lot: { block: { developmentId: { in: devIds } } } });
    }
    if (!or.length) return { id: { in: [] } };
    return { OR: or };
  }

  private async canAccessLead(
    lead: {
      property?: { userId: string } | null;
      lot?: { block: { developmentId: string } } | null;
    },
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

  private async assertLotAccess(lotId: string, userId: string, role: UserRole): Promise<void> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { block: true },
    });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    if (role === UserRole.ADMIN) return;
    const p = await this.prisma.property.findFirst({
      where: { userId, developmentId: lot.block.developmentId },
    });
    if (!p) throw new ForbiddenException('Sem permissão neste lote');
  }

  private async buildContextFromLeadId(leadId: string, variantSeed: number): Promise<CommercialMessageContext> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        lot: { include: { block: { include: { development: true } } } },
        property: { select: { title: true, price: true } },
        interactions: { orderBy: { createdAt: 'desc' }, take: 12 },
        visits: {
          orderBy: { scheduledAt: 'desc' },
          take: 8,
          include: { lot: { select: { id: true } } },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');

    const lastAt = lead.interactions[0]?.createdAt ?? lead.updatedAt;
    const daysSinceLastInteraction = Math.max(
      0,
      Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000),
    );

    const now = new Date();
    const upcoming = lead.visits.find(
      (v) =>
        v.status === 'AGENDADA' &&
        v.scheduledAt > now &&
        new Date(v.scheduledAt).getTime() - now.getTime() < 14 * 86400000,
    );
    const recentDone = lead.visits.find(
      (v) =>
        v.status === 'REALIZADA' &&
        now.getTime() - new Date(v.scheduledAt).getTime() < 5 * 86400000,
    );

    let lotPart: CommercialMessageContext['lot'] | undefined;
    if (lead.lot) {
      const l = lead.lot;
      const devId = l.block.developmentId;
      const cohortRows = await this.prisma.lot.findMany({
        where: { status: PropertyStatus.DISPONIVEL, block: { developmentId: devId } },
      });
      const cohortInputs = cohortRows.map((r) => this.toLotInput(r));
      const selfInput = this.toLotInput(l);
      const scoreResult = calculateLotSaleScore(selfInput, cohortInputs);
      const tags = commercialTags(scoreResult.score, selfInput, cohortInputs);
      const prices = cohortInputs.map((x) => x.price).filter((p): p is number => p != null && p > 0);
      const sorted = [...prices].sort((a, b) => a - b);
      const med =
        sorted.length === 0
          ? null
          : sorted.length % 2 === 1
            ? sorted[(sorted.length - 1) / 2]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      const priceNum = l.price != null ? Number(l.price) : null;
      const belowMedian =
        priceNum != null && med != null && med > 0 ? priceNum <= med * 0.92 : false;
      const daysOnMarket = Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(l.availableSince ?? l.createdAt).getTime()) / 86400000,
        ),
      );

      lotPart = {
        number: l.number,
        blockName: l.block.name,
        developmentName: l.block.development.name,
        city: l.block.development.city,
        priceText: this.formatBrl(priceNum),
        areaText: this.formatArea(l.area != null ? Number(l.area) : null),
        status: l.status,
        saleScore: scoreResult.score,
        saleClassification: scoreResult.classification,
        saleScoreReason: scoreResult.reason,
        tags,
        belowMedianPrice: belowMedian,
        daysOnMarket,
        viewCount: l.viewCount,
        contactCount: l.contactCount,
      };
    }

    const firstName = lead.name.trim().split(/\s+/)[0] ?? lead.name;

    const upcomingVisitLabel = upcoming
      ? new Date(upcoming.scheduledAt).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : undefined;

    return {
      variantSeed,
      lead: {
        firstName,
        fullName: lead.name,
        status: lead.status,
        isHot: lead.isHot,
        source: lead.leadSource ?? lead.source,
        notes: lead.notes,
        daysSinceLastInteraction,
        interactionCount: lead.interactionCount,
        closingScore: lead.closingScore != null ? Number(lead.closingScore) : undefined,
        closingPrediction: lead.closingPrediction ?? undefined,
        closingNextAction: lead.closingNextAction ?? undefined,
        closingTrend: closingScoreTrend(
          lead.previousClosingScore != null ? Number(lead.previousClosingScore) : null,
          lead.closingScore != null ? Number(lead.closingScore) : 0,
        ),
      },
      lot: lotPart,
      property: lead.property
        ? {
            title: lead.property.title,
            priceText: this.formatBrl(Number(lead.property.price)),
          }
        : undefined,
      hasUpcomingVisit: !!upcoming,
      upcomingVisitLabel,
      hadRecentCompletedVisit: !!recentDone,
    };
  }

  private async buildContextFromLotId(lotId: string, variantSeed: number): Promise<CommercialMessageContext> {
    const l = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { block: { include: { development: true } } },
    });
    if (!l) throw new NotFoundException('Lote não encontrado');

    const devId = l.block.developmentId;
    const cohortRows = await this.prisma.lot.findMany({
      where: { status: PropertyStatus.DISPONIVEL, block: { developmentId: devId } },
    });
    const cohortInputs = cohortRows.map((r) => this.toLotInput(r));
    const selfInput = this.toLotInput(l);
    const scoreResult = calculateLotSaleScore(selfInput, cohortInputs);
    const tags = commercialTags(scoreResult.score, selfInput, cohortInputs);
    const prices = cohortInputs.map((x) => x.price).filter((p): p is number => p != null && p > 0);
    const sorted = [...prices].sort((a, b) => a - b);
    const med =
      sorted.length === 0
        ? null
        : sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const priceNum = l.price != null ? Number(l.price) : null;
    const belowMedian = priceNum != null && med != null && med > 0 ? priceNum <= med * 0.92 : false;
    const daysOnMarket = Math.max(
      0,
      Math.floor((Date.now() - new Date(l.availableSince ?? l.createdAt).getTime()) / 86400000),
    );

    return {
      variantSeed,
      lot: {
        number: l.number,
        blockName: l.block.name,
        developmentName: l.block.development.name,
        city: l.block.development.city,
        priceText: this.formatBrl(priceNum),
        areaText: this.formatArea(l.area != null ? Number(l.area) : null),
        status: l.status,
        saleScore: scoreResult.score,
        saleClassification: scoreResult.classification,
        saleScoreReason: scoreResult.reason,
        tags,
        belowMedianPrice: belowMedian,
        daysOnMarket,
        viewCount: l.viewCount,
        contactCount: l.contactCount,
      },
      hasUpcomingVisit: false,
      hadRecentCompletedVisit: false,
    };
  }

  private async persistBundle(
    userId: string,
    bundle: { suggestions: Array<{ tone: string; message: string; justification: string }> },
    primaryType: AiSuggestionMessageType,
    leadId: string | null,
    lotId: string | null,
  ) {
    await this.prisma.aiMessageSuggestion.createMany({
      data: bundle.suggestions.map((s) => ({
        userId,
        leadId,
        lotId,
        messageType: primaryType,
        tone: s.tone as AiSuggestionTone,
        message: s.message,
        justification: s.justification,
      })),
    });
  }

  async generateForLead(
    leadId: string,
    userId: string,
    role: UserRole,
    opts?: { regenerate?: boolean },
  ): Promise<LeadMessageBundle> {
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
    if (!lead.lotId && !lead.propertyId) {
      throw new BadRequestException('Lead sem imóvel ou lote vinculado para contexto');
    }

    const baseSeed =
      Math.floor(Date.now() / 1000) % 997 + (opts?.regenerate ? Math.floor(Math.random() * 50) : 0);
    const ctx = await this.buildContextFromLeadId(leadId, baseSeed);
    const bundle = composeLeadMessages(ctx);

    await this.persistBundle(
      userId,
      bundle,
      bundle.primaryType as AiSuggestionMessageType,
      leadId,
      lead.lotId,
    );

    return bundle;
  }

  async generateForLot(
    lotId: string,
    userId: string,
    role: UserRole,
    opts?: { regenerate?: boolean },
  ): Promise<LotPitchBundle> {
    await this.assertLotAccess(lotId, userId, role);
    const baseSeed =
      Math.floor(Date.now() / 1000) % 997 + (opts?.regenerate ? Math.floor(Math.random() * 50) : 0);
    const ctx = await this.buildContextFromLotId(lotId, baseSeed);
    const bundle = composeLotPitch(ctx);

    await this.persistBundle(
      userId,
      bundle,
      bundle.primaryType as AiSuggestionMessageType,
      null,
      lotId,
    );

    return bundle;
  }

  async dashboardMessageRecommendations(userId: string, role: UserRole) {
    if (role === UserRole.CLIENTE) {
      return { items: [] as Array<Record<string, unknown>> };
    }

    const baseWhere = await this.leadWhereForBroker(userId, role);
    const activeWhere: Prisma.LeadWhereInput = {
      AND: [
        baseWhere,
        { status: { notIn: [LeadStatus.VENDIDO, LeadStatus.PERDIDO] } },
        { lotId: { not: null } },
      ],
    };

    const hot = await this.prisma.lead.findMany({
      where: { AND: [activeWhere, { isHot: true }] },
      take: 3,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    });

    const cold = await this.prisma.lead.findMany({
      where: {
        AND: [
          activeWhere,
          { isHot: false },
          { updatedAt: { lt: new Date(Date.now() - 8 * 86400000) } },
        ],
      },
      take: 3,
      orderBy: { updatedAt: 'asc' },
      select: { id: true, name: true },
    });

    const picked = [...hot, ...cold].slice(0, 5);
    const items: Array<{
      leadId: string;
      leadName: string;
      lotLabel: string;
      contactTiming: string;
      recommendedTone: string;
      nextAction: string;
      primaryType: string;
      typeLabel: string;
      preview: string;
      strategySummary: string;
    }> = [];

    for (const p of picked) {
      try {
        const ctx = await this.buildContextFromLeadId(p.id, (p.id.length + items.length * 3) % 100);
        const bundle = composeLeadMessages(ctx);
        const preview =
          bundle.suggestions.find((s) => s.tone === bundle.recommendedTone)?.message ??
          bundle.suggestions[0].message;
        const lot = ctx.lot;
        items.push({
          leadId: p.id,
          leadName: p.name,
          lotLabel: lot ? `Lote ${lot.number} · ${lot.developmentName}` : '—',
          contactTiming: bundle.contactTiming,
          recommendedTone: bundle.recommendedTone,
          nextAction: bundle.nextAction,
          primaryType: bundle.primaryType,
          typeLabel: bundle.typeLabel,
          preview: preview.slice(0, 220) + (preview.length > 220 ? '…' : ''),
          strategySummary: bundle.strategySummary.slice(0, 280),
        });
      } catch {
        /* skip */
      }
    }

    return { items };
  }
}
