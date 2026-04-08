import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PropertyStatus, UserRole, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  calculateLotSaleScore,
  commercialTags,
  suggestedAction,
  type LotScoreInput,
} from './lot-score.engine';

const lotRankingInclude = {
  block: { include: { development: { select: { id: true, name: true, city: true, state: true } } } },
} as const;

@Injectable()
export class LotScoringService {
  private readonly logger = new Logger(LotScoringService.name);

  constructor(private prisma: PrismaService) {}

  private async brokerDevelopmentScope(userId: string, role: UserRole): Promise<Prisma.LotWhereInput> {
    if (role === UserRole.ADMIN) return {};
    const devRows = await this.prisma.property.findMany({
      where: { userId, developmentId: { not: null } },
      select: { developmentId: true },
      distinct: ['developmentId'],
    });
    const devIds = devRows.map((r) => r.developmentId).filter((id): id is string => !!id);
    if (!devIds.length) return { id: { in: [] } };
    return { block: { developmentId: { in: devIds } } };
  }

  private toInput(row: {
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

  /** Recalcula todos os lotes DISPONÍVEIS do loteamento (preço relativo e interesse no coorte). */
  async recalculateForDevelopment(developmentId: string): Promise<void> {
    const rows = await this.prisma.lot.findMany({
      where: {
        status: PropertyStatus.DISPONIVEL,
        block: { developmentId },
      },
      include: { block: true },
    });

    const cohortInputs = rows.map((r) => this.toInput(r));

    for (let i = 0; i < rows.length; i++) {
      const lot = rows[i];
      const input = cohortInputs[i];
      const result = calculateLotSaleScore(input, cohortInputs);
      await this.prisma.lot.update({
        where: { id: lot.id },
        data: {
          saleScore: new Decimal(result.score),
          saleClassification: result.classification,
          saleScoreReason: result.reason,
          scoredAt: new Date(),
        },
      });
    }

    const other = await this.prisma.lot.findMany({
      where: {
        status: { not: PropertyStatus.DISPONIVEL },
        block: { developmentId },
      },
      select: { id: true },
    });
    for (const o of other) {
      await this.prisma.lot.update({
        where: { id: o.id },
        data: {
          saleScore: null,
          saleClassification: null,
          saleScoreReason: null,
          scoredAt: new Date(),
        },
      });
    }
  }

  async recalculateLotDevelopmentByLotId(lotId: string): Promise<void> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      select: { block: { select: { developmentId: true } } },
    });
    if (!lot) return;
    await this.recalculateForDevelopment(lot.block.developmentId);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledRecalculateAll(): Promise<void> {
    try {
      const devs = await this.prisma.development.findMany({ select: { id: true } });
      for (const d of devs) {
        await this.recalculateForDevelopment(d.id);
      }
      this.logger.debug(`Ranking recalculado para ${devs.length} loteamento(s)`);
    } catch (e) {
      this.logger.warn(`Falha no recálculo periódico: ${e}`);
    }
  }

  async findRanking(
    userId: string,
    role: UserRole,
    opts: { developmentId?: string; filter?: string },
  ) {
    const scope = await this.brokerDevelopmentScope(userId, role);
    const baseWhere: Prisma.LotWhereInput = {
      status: PropertyStatus.DISPONIVEL,
      AND: [
        scope,
        ...(opts.developmentId
          ? [{ block: { developmentId: opts.developmentId } }]
          : []),
      ],
    };

    const rows = await this.prisma.lot.findMany({
      where: baseWhere,
      include: lotRankingInclude,
      orderBy: { saleScore: 'desc' },
    });

    const cohortInputs = rows.map((r) => this.toInput(r));

    const enriched = rows.map((row, i) => {
      const input = cohortInputs[i];
      const tags = commercialTags(Number(row.saleScore ?? 0), input, cohortInputs);
      const action = suggestedAction(Number(row.saleScore ?? 0), tags);
      return {
        position: 0,
        id: row.id,
        number: row.number,
        blockId: row.blockId,
        blockName: row.block.name,
        development: row.block.development,
        price: row.price != null ? Number(row.price) : null,
        area: row.area != null ? Number(row.area) : null,
        status: row.status,
        viewCount: row.viewCount,
        contactCount: row.contactCount,
        scheduledVisitsCount: row.scheduledVisitsCount,
        proposalsCount: row.proposalsCount,
        manualHighlight: row.manualHighlight,
        saleScore: row.saleScore != null ? Number(row.saleScore) : null,
        saleClassification: row.saleClassification,
        saleScoreReason: row.saleScoreReason,
        scoredAt: row.scoredAt,
        commercialTags: tags,
        suggestedAction: action,
        availableSince: row.availableSince,
        createdAt: row.createdAt,
      };
    });

    const f = (opts.filter ?? 'melhores').toLowerCase();
    let list = [...enriched];

    switch (f) {
      case 'mais_procurados':
        list.sort((a, b) => b.viewCount - a.viewCount || (b.saleScore ?? 0) - (a.saleScore ?? 0));
        break;
      case 'mais_baratos':
        list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      case 'encalhados':
        list = list.filter((l) => l.commercialTags.includes('NECESITA_ATENCAO_COMERCIAL'));
        list.sort((a, b) => (a.saleScore ?? 0) - (b.saleScore ?? 0));
        break;
      case 'recentes':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'alta_conversao':
        list.sort(
          (a, b) =>
            b.proposalsCount + b.contactCount * 2 - (a.proposalsCount + a.contactCount * 2),
        );
        break;
      case 'baixa_conversao':
        list = list.filter((l) => l.viewCount >= 5 && l.contactCount <= 1);
        list.sort((a, b) => b.viewCount - a.viewCount);
        break;
      case 'campeoes':
        list = list.filter((l) => l.commercialTags.includes('CAMPEAO_VENDA'));
        list.sort((a, b) => (b.saleScore ?? 0) - (a.saleScore ?? 0));
        break;
      default:
        list.sort((a, b) => (b.saleScore ?? 0) - (a.saleScore ?? 0));
    }

    list.forEach((item, idx) => {
      item.position = idx + 1;
    });

    return { filter: f, items: list };
  }

  async getCommercialDashboard(userId: string, role: UserRole) {
    if (role === UserRole.CLIENTE) {
      return {
        todayPick: [],
        topSaleScore: [],
        topViewed: [],
        topContacted: [],
        topConversionPotential: [],
        stalled: [],
        champions: [],
      };
    }

    const scope = await this.brokerDevelopmentScope(userId, role);
    const available: Prisma.LotWhereInput = {
      status: PropertyStatus.DISPONIVEL,
      AND: [scope],
    };

    const base = await this.prisma.lot.findMany({
      where: available,
      include: lotRankingInclude,
    });

    const cohortInputs = base.map((r) => this.toInput(r));

    const mapItem = (row: (typeof base)[0], idx?: number) => {
      const input = this.toInput(row);
      const tags = commercialTags(Number(row.saleScore ?? 0), input, cohortInputs);
      return {
        id: row.id,
        blockId: row.blockId,
        number: row.number,
        blockName: row.block.name,
        development: row.block.development,
        price: row.price != null ? Number(row.price) : null,
        saleScore: row.saleScore != null ? Number(row.saleScore) : null,
        saleClassification: row.saleClassification,
        saleScoreReason: row.saleScoreReason,
        viewCount: row.viewCount,
        contactCount: row.contactCount,
        commercialTags: tags,
        suggestedAction: suggestedAction(Number(row.saleScore ?? 0), tags),
        position: idx,
      };
    };

    const byScore = [...base].sort((a, b) => Number(b.saleScore ?? 0) - Number(a.saleScore ?? 0));
    const byViews = [...base].sort((a, b) => b.viewCount - a.viewCount);
    const byContacts = [...base].sort((a, b) => b.contactCount - a.contactCount);
    const byPotential = [...base].sort((a, b) => {
      const sa = Number(a.saleScore ?? 0) * Math.log(2 + a.contactCount + a.proposalsCount * 2);
      const sb = Number(b.saleScore ?? 0) * Math.log(2 + b.contactCount + b.proposalsCount * 2);
      return sb - sa;
    });

    const stalled = base.filter((row) => {
      const input = this.toInput(row);
      return commercialTags(Number(row.saleScore ?? 0), input, cohortInputs).includes(
        'NECESITA_ATENCAO_COMERCIAL',
      );
    });

    const champions = base.filter((row) => {
      const input = this.toInput(row);
      return commercialTags(Number(row.saleScore ?? 0), input, cohortInputs).includes('CAMPEAO_VENDA');
    });

    return {
      todayPick: byScore.slice(0, 3).map((r, i) => mapItem(r, i + 1)),
      topSaleScore: byScore.slice(0, 5).map((r, i) => mapItem(r, i + 1)),
      topViewed: byViews.slice(0, 5).map((r, i) => mapItem(r, i + 1)),
      topContacted: byContacts.slice(0, 5).map((r, i) => mapItem(r, i + 1)),
      topConversionPotential: byPotential.slice(0, 5).map((r, i) => mapItem(r, i + 1)),
      stalled: stalled.slice(0, 5).map((r, i) => mapItem(r, i + 1)),
      champions: champions.slice(0, 5).map((r, i) => mapItem(r, i + 1)),
    };
  }
}
