import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InstagramAdObjective as PrismaAdObjective,
  InstagramAdTone as PrismaAdTone,
  InstagramContentType as PrismaContentType,
  PropertyStatus,
  UserRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateLotSaleScore,
  commercialTags,
  suggestedAction,
  type LotScoreInput,
} from '../lot-scoring/lot-score.engine';
import {
  generateInstagramAdPack,
  type InstagramAdContext,
  type InstagramAdPack,
} from './instagram-ads.engine';
import { InstagramPublishingService } from './instagram-publishing.stub';
import { LotScoringService } from '../lot-scoring/lot-scoring.service';

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export type GenerateInstagramAdsDto = {
  contentType?: PrismaContentType;
  objective?: PrismaAdObjective;
  tone?: PrismaAdTone;
  leadId?: string;
  save?: boolean;
  regenerate?: boolean;
};

export type InstagramAdRecommendation = {
  kind: 'champion' | 'stalled' | 'priority';
  lotId: string;
  blockId: string;
  developmentId: string;
  number: string;
  blockName: string;
  developmentName: string;
  reason: string;
  suggestedObjective: PrismaAdObjective;
  commercialTags: string[];
};

@Injectable()
export class InstagramAdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publishing: InstagramPublishingService,
    private readonly scoring: LotScoringService,
  ) {}

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

  private async brokerOwnsDevelopment(
    userId: string,
    developmentId: string,
  ): Promise<boolean> {
    const r = await this.prisma.property.findFirst({
      where: { userId, developmentId },
      select: { id: true },
    });
    return !!r;
  }

  private async assertDevelopmentAccess(
    userId: string,
    role: UserRole,
    developmentId: string,
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;
    const ok = await this.brokerOwnsDevelopment(userId, developmentId);
    if (!ok) throw new ForbiddenException('Sem permissão para este loteamento.');
  }

  async assertLotAccess(
    userId: string,
    role: UserRole,
    lotId: string,
  ): Promise<{ developmentId: string }> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      select: { block: { select: { developmentId: true } } },
    });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    await this.assertDevelopmentAccess(userId, role, lot.block.developmentId);
    return { developmentId: lot.block.developmentId };
  }

  private async loadLeadForLot(
    userId: string,
    role: UserRole,
    lotId: string,
    leadId: string,
  ): Promise<{
    name: string;
    closingScore: number | null;
    closingPrediction: string | null;
    closingNextAction: string | null;
  } | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, lotId },
      select: {
        id: true,
        name: true,
        closingScore: true,
        closingPrediction: true,
        closingNextAction: true,
      },
    });
    if (!lead) return null;
    await this.assertLotAccess(userId, role, lotId);
    return {
      name: lead.name,
      closingScore: lead.closingScore != null ? Number(lead.closingScore) : null,
      closingPrediction: lead.closingPrediction,
      closingNextAction: lead.closingNextAction,
    };
  }

  async buildContextForLot(
    lotId: string,
    userId: string,
    role: UserRole,
    leadId?: string,
  ): Promise<InstagramAdContext> {
    await this.assertLotAccess(userId, role, lotId);
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { block: { include: { development: true } } },
    });
    if (!lot) throw new NotFoundException('Lote não encontrado');

    const cohortRows = await this.prisma.lot.findMany({
      where: {
        status: PropertyStatus.DISPONIVEL,
        block: { developmentId: lot.block.developmentId },
      },
    });

    const selfInput = this.toInput(lot);
    let cohortInputs = cohortRows.map((r) => this.toInput(r));
    if (!cohortRows.some((r) => r.id === lot.id)) {
      cohortInputs = [...cohortInputs, selfInput];
    }

    const scoreResult = calculateLotSaleScore(selfInput, cohortInputs);
    const tags = commercialTags(scoreResult.score, selfInput, cohortInputs);
    const action = suggestedAction(scoreResult.score, tags);

    const prices = cohortInputs.map((c) => c.price).filter((p): p is number => p != null && p > 0);
    const med = median(prices);
    const priceNum = lot.price != null ? Number(lot.price) : null;
    const belowMedian = priceNum != null && med != null && med > 0 && priceNum < med;

    let leadName: string | undefined;
    let closingScore: number | null | undefined;
    let closingPrediction: string | null | undefined;
    let closingNextAction: string | null | undefined;
    if (leadId) {
      const ld = await this.loadLeadForLot(userId, role, lotId, leadId);
      if (ld) {
        leadName = ld.name;
        closingScore = ld.closingScore;
        closingPrediction = ld.closingPrediction;
        closingNextAction = ld.closingNextAction;
      }
    }

    const dev = lot.block.development;
    return {
      scope: 'LOT',
      developmentName: dev.name,
      city: dev.city,
      state: dev.state,
      neighborhood: dev.neighborhood,
      developmentDescription: dev.description,
      address: dev.address,
      lotNumber: lot.number,
      blockName: lot.block.name,
      areaM2: lot.area != null ? Number(lot.area) : null,
      priceBrl: priceNum,
      status: lot.status,
      saleScore: lot.saleScore != null ? Number(lot.saleScore) : scoreResult.score,
      saleClassification: lot.saleClassification,
      saleScoreReason: lot.saleScoreReason,
      commercialTags: tags,
      belowMedianPrice: belowMedian,
      suggestedRankAction: action,
      leadName,
      closingScore,
      closingPrediction,
      closingNextAction,
    };
  }

  async buildContextForDevelopment(
    developmentId: string,
    userId: string,
    role: UserRole,
  ): Promise<InstagramAdContext> {
    await this.assertDevelopmentAccess(userId, role, developmentId);
    const dev = await this.prisma.development.findUnique({
      where: { id: developmentId },
    });
    if (!dev) throw new NotFoundException('Loteamento não encontrado');

    const cohortRows = await this.prisma.lot.findMany({
      where: {
        status: PropertyStatus.DISPONIVEL,
        block: { developmentId },
      },
    });

    const cohortInputs = cohortRows.map((r) => this.toInput(r));
    const sorted = [...cohortRows].sort(
      (a, b) => Number(b.saleScore ?? 0) - Number(a.saleScore ?? 0),
    );
    const anchor = sorted[0];

    let tags: string[] = [];
    let rankAction: string | undefined;
    let saleScore: number | null = null;
    let saleClassification: string | null = null;
    let saleScoreReason: string | null = null;
    let belowMedian = false;

    if (anchor && cohortInputs.length) {
      const anchorInput = this.toInput(anchor);
      const scoreResult = calculateLotSaleScore(anchorInput, cohortInputs);
      tags = commercialTags(scoreResult.score, anchorInput, cohortInputs);
      rankAction = suggestedAction(scoreResult.score, tags);
      saleScore = scoreResult.score;
      saleClassification = scoreResult.classification;
      saleScoreReason = scoreResult.reason;
      const prices = cohortInputs.map((c) => c.price).filter((p): p is number => p != null && p > 0);
      const med = median(prices);
      const p0 = anchor.price != null ? Number(anchor.price) : null;
      belowMedian = p0 != null && med != null && med > 0 && p0 < med;
    } else {
      rankAction = 'Divulgue lotes disponíveis e mantenha o inventário atualizado.';
    }

    return {
      scope: 'DEVELOPMENT',
      developmentName: dev.name,
      city: dev.city,
      state: dev.state,
      neighborhood: dev.neighborhood,
      developmentDescription: dev.description,
      address: dev.address,
      commercialTags: tags,
      belowMedianPrice: belowMedian,
      suggestedRankAction: rankAction,
      status: PropertyStatus.DISPONIVEL,
      saleScore,
      saleClassification,
      saleScoreReason,
      areaM2: null,
      priceBrl: null,
    };
  }

  private nextSeed(dto: GenerateInstagramAdsDto): number {
    const base = Math.floor(Date.now() / 1000) % 100_000;
    return dto.regenerate ? base + Math.floor(Math.random() * 10_000) : base;
  }

  async generateForLot(
    userId: string,
    role: UserRole,
    lotId: string,
    dto: GenerateInstagramAdsDto,
  ): Promise<{
    pack: InstagramAdPack;
    publishing: ReturnType<InstagramPublishingService['getReadiness']>;
    savedId?: string;
  }> {
    const contentType = dto.contentType ?? PrismaContentType.FEED;
    const objective = dto.objective ?? PrismaAdObjective.AUTO;
    const tone = dto.tone ?? PrismaAdTone.AUTO;
    const ctx = await this.buildContextForLot(lotId, userId, role, dto.leadId);
    const seed = this.nextSeed(dto);
    const pack = generateInstagramAdPack(ctx, contentType, objective, tone, seed);

    let savedId: string | undefined;
    if (dto.save) {
      const row = await this.prisma.instagramAdSuggestion.create({
        data: {
          userId,
          lotId,
          developmentId: null,
          contentType,
          objective: pack.resolvedObjective as PrismaAdObjective,
          toneRequested: dto.tone ?? null,
          strategicNote: pack.strategicJustification,
          payloadJson: { pack, seed, leadId: dto.leadId ?? null } as Prisma.InputJsonValue,
        },
      });
      savedId = row.id;
    }

    return {
      pack,
      publishing: this.publishing.getReadiness(),
      savedId,
    };
  }

  async generateForDevelopment(
    userId: string,
    role: UserRole,
    developmentId: string,
    dto: GenerateInstagramAdsDto,
  ): Promise<{
    pack: InstagramAdPack;
    publishing: ReturnType<InstagramPublishingService['getReadiness']>;
    savedId?: string;
  }> {
    const contentType = dto.contentType ?? PrismaContentType.FEED;
    const objective = dto.objective ?? PrismaAdObjective.AUTO;
    const tone = dto.tone ?? PrismaAdTone.AUTO;
    const ctx = await this.buildContextForDevelopment(developmentId, userId, role);
    const seed = this.nextSeed(dto);
    const pack = generateInstagramAdPack(ctx, contentType, objective, tone, seed);

    let savedId: string | undefined;
    if (dto.save) {
      const row = await this.prisma.instagramAdSuggestion.create({
        data: {
          userId,
          lotId: null,
          developmentId,
          contentType,
          objective: pack.resolvedObjective as PrismaAdObjective,
          toneRequested: dto.tone ?? null,
          strategicNote: pack.strategicJustification,
          payloadJson: { pack, seed } as Prisma.InputJsonValue,
        },
      });
      savedId = row.id;
    }

    return {
      pack,
      publishing: this.publishing.getReadiness(),
      savedId,
    };
  }

  async getDashboardRecommendations(
    userId: string,
    role: UserRole,
  ): Promise<{ items: InstagramAdRecommendation[] }> {
    const intel = await this.scoring.getCommercialDashboard(userId, role);
    const raw: InstagramAdRecommendation[] = [];

    for (const lot of intel.champions) {
      raw.push({
        kind: 'champion',
        lotId: lot.id,
        blockId: lot.blockId,
        developmentId: lot.development.id,
        number: lot.number,
        blockName: lot.blockName,
        developmentName: lot.development.name,
        reason: 'Campeão de venda no ranking — divulgue com narrativa forte.',
        suggestedObjective: PrismaAdObjective.DESTACAR_CAMPEAO,
        commercialTags: lot.commercialTags,
      });
    }
    for (const lot of intel.stalled) {
      raw.push({
        kind: 'stalled',
        lotId: lot.id,
        blockId: lot.blockId,
        developmentId: lot.development.id,
        number: lot.number,
        blockName: lot.blockName,
        developmentName: lot.development.name,
        reason: 'Lote com sinais de estoque — teste nova abordagem e CTA.',
        suggestedObjective: PrismaAdObjective.REATIVAR_ENCALHADO,
        commercialTags: lot.commercialTags,
      });
    }
    for (const lot of intel.todayPick) {
      raw.push({
        kind: 'priority',
        lotId: lot.id,
        blockId: lot.blockId,
        developmentId: lot.development.id,
        number: lot.number,
        blockName: lot.blockName,
        developmentName: lot.development.name,
        reason: 'Entre os melhores scores hoje — boa prioridade de postagem.',
        suggestedObjective: PrismaAdObjective.CAPTAR_LEADS,
        commercialTags: lot.commercialTags,
      });
    }

    const seen = new Set<string>();
    const items = raw.filter((x) => {
      if (seen.has(x.lotId)) return false;
      seen.add(x.lotId);
      return true;
    });
    return { items: items.slice(0, 10) };
  }
}
