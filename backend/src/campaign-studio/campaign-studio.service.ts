import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AiImageJobStatus,
  CampaignAssetKind,
  CampaignAssetOrigin,
  MarketingCampaignKind,
  MarketingCampaignStatus,
  Prisma,
  PublicationPlatform,
  PublicationTargetStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InstagramAdsService } from '../instagram-ads/instagram-ads.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { buildCampaignCopyUpsertOperations, buildPlainCopyUpserts } from './campaign-copy.mapper';
import {
  buildPlainCaption,
  isValidTemplateId,
  listCaptionTemplateMeta,
} from './campaign-plain-templates';
import { CampaignPublisherService } from './campaign-publisher.service';
import { CampaignExportService } from './campaign-export.service';
import { InstagramPublisherService } from './instagram-publisher.service';
import { FacebookPublisherService } from './facebook-publisher.service';
import { WhatsAppDistributionService } from './whatsapp-distribution.service';
import { MetaOAuthService } from '../social/meta-oauth.service';
import { SocialConnectionService } from '../social/social-connection.service';
import type { PublishCampaignDto } from './dto/publish-campaign.dto';
import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';
import type { GenerateCampaignTextDto } from './dto/generate-campaign-text.dto';
import type { AddBankAssetsDto } from './dto/campaign-assets.dto';
import type { GenerateAiImageDto, SuggestedImagePromptDto } from './dto/ai-image.dto';
import {
  CAMPAIGN_IMAGE_PROVIDER,
  type ICampaignImageGenerationProvider,
} from './image-generation/campaign-image-provider.token';
import { GeminiCampaignTextService } from './gemini-campaign-text.service';
import type { InstagramAdPack } from '../instagram-ads/instagram-ads.engine';
import { CampaignPublicationOpLogService } from './campaign-publication-op-log.service';

const campaignDetailInclude = {
  assets: { orderBy: { sortOrder: 'asc' as const } },
  targets: true,
  copies: true,
  user: { select: { id: true, name: true, email: true } },
  development: { select: { id: true, name: true, city: true, state: true, coverImage: true } },
  lot: {
    select: {
      id: true,
      number: true,
      price: true,
      block: { select: { name: true, id: true, developmentId: true } },
    },
  },
  block: { select: { id: true, name: true, developmentId: true } },
} as const;

@Injectable()
export class CampaignStudioService {
  private readonly logger = new Logger(CampaignStudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instagramAds: InstagramAdsService,
    private readonly cloudinary: CloudinaryService,
    private readonly publisher: CampaignPublisherService,
    private readonly exportService: CampaignExportService,
    private readonly geminiText: GeminiCampaignTextService,
    private readonly metaOAuth: MetaOAuthService,
    private readonly socialConnections: SocialConnectionService,
    private readonly instagramPublisher: InstagramPublisherService,
    private readonly facebookPublisher: FacebookPublisherService,
    private readonly whatsappDistribution: WhatsAppDistributionService,
    private readonly publicationOpLog: CampaignPublicationOpLogService,
    @Inject(CAMPAIGN_IMAGE_PROVIDER)
    private readonly imageProvider: ICampaignImageGenerationProvider,
  ) {}

  /**
   * Corretor pode trabalhar em um loteamento se:
   * - tiver imóvel (Property) vinculado ao empreendimento, ou
   * - já tiver lead, visita, simulação ou campanha ligada a lotes/imóveis desse empreendimento.
   * (Só Property exclui quem só usa lotes do catálogo demo sem vínculo.)
   */
  private async brokerHasDevelopmentAccess(userId: string, developmentId: string): Promise<boolean> {
    const byProperty = await this.prisma.property.findFirst({
      where: { userId, developmentId },
      select: { id: true },
    });
    if (byProperty) return true;

    const byLead = await this.prisma.lead.findFirst({
      where: { userId, lot: { block: { developmentId } } },
      select: { id: true },
    });
    if (byLead) return true;

    const byVisit = await this.prisma.visit.findFirst({
      where: { userId, lot: { block: { developmentId } } },
      select: { id: true },
    });
    if (byVisit) return true;

    const bySim = await this.prisma.simulation.findFirst({
      where: {
        userId,
        OR: [{ lot: { block: { developmentId } } }, { property: { developmentId } }],
      },
      select: { id: true },
    });
    if (bySim) return true;

    const byCampaign = await this.prisma.marketingCampaign.findFirst({
      where: { userId, developmentId },
      select: { id: true },
    });
    if (byCampaign) return true;

    return false;
  }

  private async assertDevelopmentAccess(
    userId: string,
    role: UserRole,
    developmentId: string,
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;
    const ok = await this.brokerHasDevelopmentAccess(userId, developmentId);
    if (!ok) throw new ForbiddenException('Sem permissão para este loteamento.');
  }

  private async assertCampaignOwner(userId: string, role: UserRole, campaignId: string) {
    const c = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: campaignDetailInclude,
    });
    if (!c) throw new NotFoundException('Campanha não encontrada');
    if (role !== UserRole.ADMIN && c.userId !== userId) {
      throw new ForbiddenException('Esta campanha pertence a outro usuário.');
    }
    if (c.developmentId) {
      await this.assertDevelopmentAccess(userId, role, c.developmentId);
    }
    return c;
  }

  async create(userId: string, role: UserRole, dto: CreateCampaignDto) {
    const kind = dto.campaignKind ?? MarketingCampaignKind.LOTEMENTO;
    const developmentId = dto.developmentId?.trim() || null;

    if (kind !== MarketingCampaignKind.INSTITUCIONAL && !developmentId) {
      throw new BadRequestException('Informe o loteamento ou selecione o tipo campanha institucional.');
    }
    if (developmentId) {
      await this.assertDevelopmentAccess(userId, role, developmentId);
    }

    let blockId: string | null = dto.blockId?.trim() || null;
    if (blockId) {
      const block = await this.prisma.block.findUnique({
        where: { id: blockId },
        select: { id: true, developmentId: true },
      });
      if (!block) throw new NotFoundException('Quadra não encontrada');
      if (developmentId && block.developmentId !== developmentId) {
        throw new BadRequestException('A quadra não pertence ao loteamento selecionado.');
      }
      if (!developmentId) {
        throw new BadRequestException('Campanha por quadra exige loteamento associado.');
      }
    }

    const lotId = dto.lotId?.trim() || undefined;
    if (lotId) {
      if (!developmentId) throw new BadRequestException('Lote exige loteamento.');
      const lot = await this.prisma.lot.findUnique({
        where: { id: lotId },
        select: { id: true, block: { select: { developmentId: true, id: true } } },
      });
      if (!lot) throw new NotFoundException('Lote não encontrado');
      if (lot.block.developmentId !== developmentId) {
        throw new ForbiddenException('Lote não pertence a este loteamento.');
      }
      if (blockId && lot.block.id !== blockId) {
        throw new BadRequestException('O lote não pertence à quadra informada.');
      }
    }

    const scheduled = dto.scheduledPublishAt?.trim()
      ? new Date(dto.scheduledPublishAt)
      : null;
    if (scheduled && Number.isNaN(scheduled.getTime())) {
      throw new BadRequestException('Data de agendamento inválida.');
    }

    const status = this.publisher.defaultTargetStatus();

    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.marketingCampaign.create({
        data: {
          userId,
          developmentId,
          lotId: lotId ?? null,
          blockId,
          title: dto.title.trim(),
          objective: dto.objective ?? undefined,
          campaignKind: kind,
          commercialObjective: dto.commercialObjective ?? undefined,
          internalDescription: dto.internalDescription?.trim() ?? null,
          audienceNotes: dto.audienceNotes?.trim() ?? null,
          primaryCaption: dto.primaryCaption?.trim() ?? null,
          scheduledPublishAt: scheduled,
          targets: {
            create: dto.platforms.map((platform) => ({
              platform,
              status,
              aspectHint: this.aspectHintForPlatform(platform),
            })),
          },
        },
        include: campaignDetailInclude,
      });
      return campaign;
    });
  }

  private aspectHintForPlatform(platform: PublicationPlatform): string {
    switch (platform) {
      case 'INSTAGRAM_STORY':
      case 'INSTAGRAM_REEL':
        return '9:16';
      case 'INSTAGRAM_FEED':
        return '4:5';
      default:
        return '1:1';
    }
  }

  getCapabilities() {
    return {
      geminiConfigured: this.geminiText.isConfigured(),
      imageGenerationProvider: this.imageProvider.name,
      publishingNote: this.publisher.readinessNote(),
      metaOAuthConfigured: this.metaOAuth.isConfigured(),
    };
  }

  async publish(userId: string, role: UserRole, campaignId: string, dto: PublishCampaignDto) {
    const campaign = await this.assertCampaignOwner(userId, role, campaignId);

    if (campaign.status === MarketingCampaignStatus.PROCESSING) {
      throw new BadRequestException(
        'Campanha em processamento automático. Aguarde o término ou cancele o agendamento.',
      );
    }
    if (
      campaign.status === MarketingCampaignStatus.SCHEDULED ||
      campaign.status === MarketingCampaignStatus.QUEUED ||
      campaign.status === MarketingCampaignStatus.RETRYING
    ) {
      await this.prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          status: MarketingCampaignStatus.READY,
          scheduledPublishAt: null,
          nextRetryAt: null,
          publicationLockUntil: null,
          publishFailureReason: null,
        },
      });
    }

    if (dto.platform === 'WHATSAPP') {
      throw new BadRequestException(
        'WhatsApp não usa a API de feed. Use o fluxo assistido (link wa.me) no aplicativo.',
      );
    }
    if (dto.platform === 'EXPORT_PACKAGE') {
      throw new BadRequestException('O pacote de exportação não é “publicado”; use baixar JSON ou criativos no app.');
    }
    if (dto.platform === 'INSTAGRAM_STORY' || dto.platform === 'INSTAGRAM_REEL') {
      return {
        manual: true,
        platform: dto.platform,
        message:
          'Story e Reel exigem vídeo ou fluxo específico no app Instagram. Use a pré-visualização e finalize manualmente no Instagram.',
      };
    }

    const connectionId = await this.socialConnections.resolveConnectionIdForPublishing(
      userId,
      role,
      dto.socialConnectionId?.trim(),
    );

    if (dto.platform === 'INSTAGRAM_FEED') {
      return this.instagramPublisher.publishFeed({
        userId,
        role,
        campaignId,
        socialConnectionId: connectionId,
      });
    }
    if (dto.platform === 'FACEBOOK_POST') {
      return this.facebookPublisher.publishPhotoPost({
        userId,
        role,
        campaignId,
        socialConnectionId: connectionId,
      });
    }

    throw new BadRequestException('Plataforma não suportada para publicação automática.');
  }

  async whatsappPayload(userId: string, role: UserRole, campaignId: string) {
    await this.assertCampaignOwner(userId, role, campaignId);
    const payload = await this.whatsappDistribution.buildPayloadForCampaign(campaignId);
    if (!payload) throw new NotFoundException('Campanha não encontrada');
    return payload;
  }

  async list(
    userId: string,
    role: UserRole,
    filters: {
      developmentId?: string;
      lotId?: string;
      status?: string;
      campaignKind?: string;
      userIdFilter?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const statuses: MarketingCampaignStatus[] = [
      'DRAFT',
      'READY',
      'SCHEDULED',
      'QUEUED',
      'PROCESSING',
      'PUBLISHED',
      'FAILED',
      'RETRYING',
      'CANCELED',
      'ARCHIVED',
    ];
    const kinds: MarketingCampaignKind[] = [
      'LOTEMENTO',
      'LOTE',
      'INSTITUCIONAL',
      'PROMOCAO',
      'REENGAJAMENTO',
    ];

    const where: Prisma.MarketingCampaignWhereInput = {
      ...(filters.developmentId ? { developmentId: filters.developmentId } : {}),
      ...(filters.lotId ? { lotId: filters.lotId } : {}),
      ...(filters.status && statuses.includes(filters.status as MarketingCampaignStatus)
        ? { status: filters.status as MarketingCampaignStatus }
        : {}),
      ...(filters.campaignKind && kinds.includes(filters.campaignKind as MarketingCampaignKind)
        ? { campaignKind: filters.campaignKind as MarketingCampaignKind }
        : {}),
      ...(role === UserRole.ADMIN
        ? filters.userIdFilter
          ? { userId: filters.userIdFilter }
          : {}
        : { userId }),
      ...(() => {
        if (!filters.from && !filters.to) return {};
        const range: Prisma.DateTimeFilter = {};
        if (filters.from) {
          const d = new Date(filters.from);
          if (!Number.isNaN(d.getTime())) range.gte = d;
        }
        if (filters.to) {
          const d = new Date(filters.to);
          if (!Number.isNaN(d.getTime())) range.lte = d;
        }
        return Object.keys(range).length ? { createdAt: range } : {};
      })(),
    };

    return this.prisma.marketingCampaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 120,
      include: {
        development: { select: { name: true, city: true } },
        lot: { select: { number: true } },
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { assets: true, copies: true } },
        targets: { select: { platform: true, status: true } },
      },
    });
  }

  captionTemplates() {
    return listCaptionTemplateMeta();
  }

  async applyCaptionTemplate(userId: string, role: UserRole, campaignId: string, templateId: string) {
    if (!isValidTemplateId(templateId)) {
      throw new BadRequestException('Template de legenda inválido.');
    }
    const campaign = await this.assertCampaignOwner(userId, role, campaignId);

    const dev = campaign.development;
    const lot = campaign.lot;
    const priceLabel =
      lot?.price != null
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(lot.price))
        : undefined;

    const plain = buildPlainCaption(templateId, {
      campaignTitle: campaign.title,
      developmentName: dev?.name,
      city: dev?.city,
      lotNumber: lot?.number,
      blockName: lot?.block?.name,
      priceLabel,
      audienceNotes: campaign.audienceNotes,
      internalDescription: campaign.internalDescription,
    });

    const platforms = campaign.targets.map((t) => t.platform);
    const upserts = buildPlainCopyUpserts(campaignId, platforms, plain);

    await this.prisma.$transaction([
      this.prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          primaryCaption: plain.feedCaption,
          lastGeneratedAt: new Date(),
        },
      }),
      ...upserts.map((u) => this.prisma.campaignCopy.upsert(u)),
      ...campaign.targets.map((t) =>
        this.prisma.campaignPublicationTarget.update({
          where: { id: t.id },
          data: { status: PublicationTargetStatus.PREPARED },
        }),
      ),
    ]);

    return this.prisma.marketingCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: campaignDetailInclude,
    });
  }

  async getById(userId: string, role: UserRole, id: string) {
    return this.assertCampaignOwner(userId, role, id);
  }

  async update(userId: string, role: UserRole, id: string, dto: UpdateCampaignDto) {
    const current = await this.assertCampaignOwner(userId, role, id);

    let nextDevelopmentId = current.developmentId;
    if (dto.developmentId !== undefined) {
      nextDevelopmentId = dto.developmentId?.trim() || null;
      if (nextDevelopmentId) {
        await this.assertDevelopmentAccess(userId, role, nextDevelopmentId);
      }
    }

    const kind = dto.campaignKind ?? current.campaignKind;
    if (kind !== MarketingCampaignKind.INSTITUCIONAL && !nextDevelopmentId) {
      throw new BadRequestException('Campanha sem loteamento exige tipo institucional.');
    }

    let scheduled: Date | null | undefined;
    if (dto.scheduledPublishAt !== undefined) {
      scheduled = dto.scheduledPublishAt?.trim() ? new Date(dto.scheduledPublishAt) : null;
      if (scheduled && Number.isNaN(scheduled.getTime())) {
        throw new BadRequestException('Data de agendamento inválida.');
      }
    }

    const nextStatus = dto.status ?? current.status;
    if (nextStatus === MarketingCampaignStatus.SCHEDULED) {
      const effective =
        scheduled !== undefined
          ? scheduled
          : dto.scheduledPublishAt === undefined
            ? current.scheduledPublishAt
            : null;
      if (!effective || Number.isNaN(effective.getTime())) {
        throw new BadRequestException(
          'Para agendar, informe data e hora válidas (scheduledPublishAt).',
        );
      }
    }

    let scheduledChannelsPayload: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
    if (dto.scheduledChannels !== undefined) {
      const allowed = dto.scheduledChannels.filter(
        (p) =>
          p === PublicationPlatform.INSTAGRAM_FEED || p === PublicationPlatform.FACEBOOK_POST,
      );
      scheduledChannelsPayload =
        allowed.length > 0 ? (allowed as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    return this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.objective != null ? { objective: dto.objective } : {}),
        ...(dto.campaignKind != null ? { campaignKind: dto.campaignKind } : {}),
        ...(dto.commercialObjective !== undefined ? { commercialObjective: dto.commercialObjective } : {}),
        ...(dto.internalDescription !== undefined
          ? { internalDescription: dto.internalDescription?.trim() ?? null }
          : {}),
        ...(dto.audienceNotes !== undefined ? { audienceNotes: dto.audienceNotes?.trim() ?? null } : {}),
        ...(dto.primaryCaption !== undefined ? { primaryCaption: dto.primaryCaption?.trim() ?? null } : {}),
        ...(dto.scheduledPublishAt !== undefined ? { scheduledPublishAt: scheduled } : {}),
        ...(dto.scheduleTimezone !== undefined
          ? { scheduleTimezone: dto.scheduleTimezone?.trim() || 'America/Sao_Paulo' }
          : {}),
        ...(scheduledChannelsPayload !== undefined
          ? { scheduledChannelsJson: scheduledChannelsPayload }
          : {}),
        ...(dto.scheduledSocialConnectionId !== undefined
          ? {
              scheduledSocialConnectionId: dto.scheduledSocialConnectionId?.trim() || null,
            }
          : {}),
        ...(dto.autoRetryEnabled !== undefined ? { autoRetryEnabled: dto.autoRetryEnabled } : {}),
        ...(dto.maxRetries !== undefined ? { maxRetries: dto.maxRetries } : {}),
        ...(dto.developmentId !== undefined
          ? dto.developmentId?.trim()
            ? { development: { connect: { id: dto.developmentId.trim() } } }
            : { development: { disconnect: true } }
          : {}),
        ...(dto.lotId !== undefined
          ? dto.lotId?.trim()
            ? { lot: { connect: { id: dto.lotId.trim() } } }
            : { lot: { disconnect: true } }
          : {}),
        ...(dto.blockId !== undefined
          ? dto.blockId?.trim()
            ? { block: { connect: { id: dto.blockId.trim() } } }
            : { block: { disconnect: true } }
          : {}),
      },
      include: campaignDetailInclude,
    });
  }

  async archive(userId: string, role: UserRole, id: string) {
    await this.assertCampaignOwner(userId, role, id);
    return this.prisma.marketingCampaign.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include: campaignDetailInclude,
    });
  }

  async cancelSchedule(userId: string, role: UserRole, id: string) {
    const c = await this.assertCampaignOwner(userId, role, id);
    if (
      c.status !== MarketingCampaignStatus.SCHEDULED &&
      c.status !== MarketingCampaignStatus.QUEUED &&
      c.status !== MarketingCampaignStatus.RETRYING
    ) {
      throw new BadRequestException(
        'Só é possível cancelar campanhas agendadas, na fila ou aguardando nova tentativa.',
      );
    }
    const updated = await this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        status: MarketingCampaignStatus.CANCELED,
        scheduledPublishAt: null,
        nextRetryAt: null,
        publicationLockUntil: null,
        publishFailureReason: null,
      },
      include: campaignDetailInclude,
    });
    await this.publicationOpLog.log({
      campaignId: id,
      userId,
      action: 'SCHEDULE_CANCELED',
      status: 'OK',
      message: 'Agendamento cancelado pelo usuário.',
      executedByUserId: userId,
    });
    return updated;
  }

  async retryPublishManual(userId: string, role: UserRole, id: string) {
    const c = await this.assertCampaignOwner(userId, role, id);
    if (
      c.status !== MarketingCampaignStatus.FAILED &&
      c.status !== MarketingCampaignStatus.RETRYING
    ) {
      throw new BadRequestException(
        'Reprocessamento manual só está disponível para campanhas com falha ou em retry.',
      );
    }
    const updated = await this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        status: MarketingCampaignStatus.QUEUED,
        nextRetryAt: null,
        publicationLockUntil: null,
        publishFailureReason: null,
      },
      include: campaignDetailInclude,
    });
    await this.publicationOpLog.log({
      campaignId: id,
      userId,
      action: 'MANUAL_RETRY_QUEUED',
      status: 'OK',
      message: 'Campanha recolocada na fila para nova tentativa.',
      executedByUserId: userId,
    });
    return updated;
  }

  async listPublicationOpLogs(userId: string, role: UserRole, campaignId: string) {
    await this.assertCampaignOwner(userId, role, campaignId);
    return this.prisma.campaignPublicationOpLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        action: true,
        channel: true,
        status: true,
        message: true,
        externalPostId: true,
        attemptNumber: true,
        createdAt: true,
        executedByUserId: true,
      },
    });
  }

  async publicationOpsSummary(_userId: string, role: UserRole) {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem ver o painel operacional.');
    }
    const [
      scheduled,
      queued,
      processing,
      published,
      failed,
      retrying,
      canceled,
    ] = await Promise.all([
      this.prisma.marketingCampaign.count({ where: { status: MarketingCampaignStatus.SCHEDULED } }),
      this.prisma.marketingCampaign.count({ where: { status: MarketingCampaignStatus.QUEUED } }),
      this.prisma.marketingCampaign.count({ where: { status: MarketingCampaignStatus.PROCESSING } }),
      this.prisma.marketingCampaign.count({ where: { status: MarketingCampaignStatus.PUBLISHED } }),
      this.prisma.marketingCampaign.count({ where: { status: MarketingCampaignStatus.FAILED } }),
      this.prisma.marketingCampaign.count({ where: { status: MarketingCampaignStatus.RETRYING } }),
      this.prisma.marketingCampaign.count({ where: { status: MarketingCampaignStatus.CANCELED } }),
    ]);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const publishedLast7d = await this.prisma.marketingCampaign.count({
      where: {
        status: MarketingCampaignStatus.PUBLISHED,
        campaignPublishedAt: { gte: since },
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        scheduled,
        queued,
        processing,
        published,
        failed,
        retrying,
        canceled,
        publishedLast7d,
      },
    };
  }

  /** Duplica rascunho, alvos, cópias e referências de imagem (mesmas URLs). */
  async duplicate(userId: string, role: UserRole, id: string, title?: string) {
    const src = await this.assertCampaignOwner(userId, role, id);
    const status = this.publisher.defaultTargetStatus();
    const newTitle = (title?.trim() || `${src.title} (cópia)`).slice(0, 200);

    return this.prisma.$transaction(async (tx) => {
      const dup = await tx.marketingCampaign.create({
        data: {
          userId,
          developmentId: src.developmentId,
          blockId: src.blockId,
          lotId: src.lotId,
          title: newTitle,
          objective: src.objective,
          campaignKind: src.campaignKind,
          commercialObjective: src.commercialObjective ?? undefined,
          internalDescription: src.internalDescription,
          audienceNotes: src.audienceNotes,
          primaryCaption: src.primaryCaption,
          status: 'DRAFT',
          primaryContentType: src.primaryContentType,
          packJson: src.packJson ?? undefined,
          lastGeneratedAt: src.lastGeneratedAt ?? undefined,
          scheduledPublishAt: null,
          scheduleTimezone: 'America/Sao_Paulo',
          scheduledSocialConnectionId: null,
          autoRetryEnabled: true,
          retryCount: 0,
          maxRetries: 3,
          lastPublishAttemptAt: null,
          nextRetryAt: null,
          campaignPublishedAt: null,
          publishFailureReason: null,
          publicationLockUntil: null,
          targets: {
            create: src.targets.map((t) => ({
              platform: t.platform,
              status,
              aspectHint: t.aspectHint,
            })),
          },
        },
      });

      for (const a of src.assets) {
        await tx.campaignAsset.create({
          data: {
            campaignId: dup.id,
            kind: a.kind,
            origin: a.origin,
            url: a.url,
            publicId: a.publicId,
            fileName: a.fileName,
            mimeType: a.mimeType,
            isPrimary: a.isPrimary,
            sortOrder: a.sortOrder,
            sourcePropertyImageId: a.sourcePropertyImageId,
          },
        });
      }

      for (const c of src.copies) {
        await tx.campaignCopy.create({
          data: {
            campaignId: dup.id,
            platform: c.platform,
            title: c.title,
            caption: c.caption,
            shortCaption: c.shortCaption,
            cta: c.cta,
            hashtags: c.hashtags,
            reelScriptJson: c.reelScriptJson ?? undefined,
            professionalTone: c.professionalTone,
            persuasiveTone: c.persuasiveTone,
            directTone: c.directTone,
            justification: c.justification,
          },
        });
      }

      return tx.marketingCampaign.findUniqueOrThrow({
        where: { id: dup.id },
        include: campaignDetailInclude,
      });
    });
  }

  async availableImages(
    userId: string,
    role: UserRole,
    developmentId: string,
    _lotId?: string,
  ) {
    await this.assertDevelopmentAccess(userId, role, developmentId);
    const dev = await this.prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, name: true, coverImage: true, coverImageAlt: true },
    });
    if (!dev) throw new NotFoundException('Loteamento não encontrado');

    const properties = await this.prisma.property.findMany({
      where: { userId, developmentId },
      select: {
        id: true,
        title: true,
        images: { orderBy: { order: 'asc' }, select: { id: true, url: true, publicId: true } },
      },
    });

    type Item = {
      id: string;
      url: string;
      publicId: string | null;
      source: 'DEVELOPMENT_COVER' | 'PROPERTY_GALLERY';
      label: string | null;
    };
    const items: Item[] = [];
    if (dev.coverImage) {
      items.push({
        id: `development-cover:${dev.id}`,
        url: dev.coverImage,
        publicId: null,
        source: 'DEVELOPMENT_COVER',
        label: dev.coverImageAlt ?? `Capa — ${dev.name}`,
      });
    }
    for (const p of properties) {
      for (const img of p.images) {
        items.push({
          id: img.id,
          url: img.url,
          publicId: img.publicId,
          source: 'PROPERTY_GALLERY',
          label: p.title,
        });
      }
    }
    return { developmentId, items };
  }

  async addBankAssets(userId: string, role: UserRole, campaignId: string, dto: AddBankAssetsDto) {
    const c = await this.assertCampaignOwner(userId, role, campaignId);
    const start = await this.prisma.campaignAsset.count({ where: { campaignId } });
    const created = await this.prisma.$transaction(
      dto.items.map((item, i) =>
        this.prisma.campaignAsset.create({
          data: {
            campaignId,
            kind: CampaignAssetKind.SYSTEM_IMAGE,
            origin: CampaignAssetOrigin.BANK,
            url: item.url,
            publicId: item.publicId ?? null,
            fileName: item.fileName ?? null,
            mimeType: 'image/*',
            sortOrder: start + i,
            isPrimary: start === 0 && i === 0 && c.assets.length === 0,
            sourcePropertyImageId: item.sourcePropertyImageId?.trim() || null,
          },
        }),
      ),
    );
    return { added: created };
  }

  async uploadAssets(
    userId: string,
    role: UserRole,
    campaignId: string,
    files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('Nenhum arquivo enviado');
    const c = await this.assertCampaignOwner(userId, role, campaignId);
    const start = await this.prisma.campaignAsset.count({ where: { campaignId } });
    const folder = `imobflow/campaigns/${campaignId}`;
    const created = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const { url, publicId } = await this.cloudinary.uploadImage(file, folder);
      created.push(
        await this.prisma.campaignAsset.create({
          data: {
            campaignId,
            kind: CampaignAssetKind.UPLOADED_IMAGE,
            origin: CampaignAssetOrigin.UPLOAD,
            url,
            publicId,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sortOrder: start + i,
            isPrimary: c.assets.length === 0 && i === 0,
          },
        }),
      );
    }
    return { added: created };
  }

  async deleteAsset(userId: string, role: UserRole, campaignId: string, assetId: string) {
    await this.assertCampaignOwner(userId, role, campaignId);
    const asset = await this.prisma.campaignAsset.findFirst({
      where: { id: assetId, campaignId },
    });
    if (!asset) throw new NotFoundException('Asset não encontrado');
    if (asset.publicId && asset.origin === CampaignAssetOrigin.UPLOAD) {
      try {
        await this.cloudinary.deleteImage(asset.publicId);
      } catch {
        /* ignore */
      }
    }
    await this.prisma.campaignAsset.delete({ where: { id: assetId } });
    return { ok: true };
  }

  async patchAsset(
    userId: string,
    role: UserRole,
    campaignId: string,
    assetId: string,
    body: { isPrimary?: boolean; sortOrder?: number },
  ) {
    await this.assertCampaignOwner(userId, role, campaignId);
    const asset = await this.prisma.campaignAsset.findFirst({
      where: { id: assetId, campaignId },
    });
    if (!asset) throw new NotFoundException('Asset não encontrado');

    if (body.isPrimary === true) {
      await this.prisma.$transaction([
        this.prisma.campaignAsset.updateMany({
          where: { campaignId },
          data: { isPrimary: false },
        }),
        this.prisma.campaignAsset.update({
          where: { id: assetId },
          data: { isPrimary: true },
        }),
      ]);
    } else if (body.sortOrder != null) {
      await this.prisma.campaignAsset.update({
        where: { id: assetId },
        data: { sortOrder: body.sortOrder },
      });
    }
    return this.prisma.campaignAsset.findUnique({ where: { id: assetId } });
  }

  async generateText(userId: string, role: UserRole, campaignId: string, dto: GenerateCampaignTextDto) {
    try {
      const campaign = await this.assertCampaignOwner(userId, role, campaignId);

      if (!campaign.developmentId) {
        throw new BadRequestException(
          'Associe um loteamento à campanha para usar o gerador de anúncios com IA. Para campanhas institucionais, use Templates de legenda (sem motor de anúncios).',
        );
      }

      const genDto = {
        contentType: dto.contentType,
        objective: dto.objective,
        tone: dto.tone,
        leadId: dto.leadId,
        save: dto.saveInstagramHistory === true,
        regenerate: true,
      };

      const generated = campaign.lotId
        ? await this.instagramAds.generateForLot(userId, role, campaign.lotId, genDto)
        : await this.instagramAds.generateForDevelopment(userId, role, campaign.developmentId, genDto);

      let finalPack: InstagramAdPack = generated.pack;
      let geminiRefined = false;
      if (dto.useGeminiLlm === true && this.geminiText.isConfigured()) {
        const refined = await this.geminiText.refinePack(finalPack);
        if (refined) {
          finalPack = refined;
          geminiRefined = true;
        }
      }

      const vIdx = dto.variationIndex ?? 0;
      const platforms = campaign.targets.map((t) => t.platform);
      const upserts = buildCampaignCopyUpsertOperations(
        campaignId,
        finalPack,
        platforms,
        vIdx,
      );

      await this.prisma.$transaction([
        this.prisma.marketingCampaign.update({
          where: { id: campaignId },
          data: {
            packJson: finalPack as unknown as Prisma.InputJsonValue,
            lastGeneratedAt: new Date(),
            ...(dto.objective != null ? { objective: dto.objective } : {}),
            ...(dto.contentType != null ? { primaryContentType: dto.contentType } : {}),
          },
        }),
        ...upserts.map((u) => this.prisma.campaignCopy.upsert(u)),
        ...campaign.targets.map((t) =>
          this.prisma.campaignPublicationTarget.update({
            where: { id: t.id },
            data: { status: PublicationTargetStatus.PREPARED },
          }),
        ),
      ]);

      return {
        pack: finalPack,
        publishing: generated.publishing,
        savedInstagramSuggestionId: generated.savedId,
        variationIndex: vIdx,
        copiesSynced: upserts.length,
        geminiRefined,
        geminiAvailable: this.geminiText.isConfigured(),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`generateText falhou (campaign=${campaignId}): ${msg}`, e instanceof Error ? e.stack : undefined);
      throw e;
    }
  }

  async exportBundle(userId: string, role: UserRole, campaignId: string) {
    await this.assertCampaignOwner(userId, role, campaignId);
    const bundle = await this.exportService.buildExportBundle(campaignId);
    if (!bundle) throw new NotFoundException('Campanha não encontrada');
    return bundle;
  }

  async suggestedImagePrompt(
    userId: string,
    role: UserRole,
    campaignId: string,
    dto: SuggestedImagePromptDto,
  ) {
    const c = await this.assertCampaignOwner(userId, role, campaignId);
    const style = dto.style?.trim() || 'moderno, limpo, alto contraste';
    const platform = dto.platform ?? 'INSTAGRAM_FEED';
    const lotLine = c.lot
      ? `lote ${c.lot.number} (quadra ${c.lot.block.name})`
      : 'loteamento em destaque';
    const devLine = c.development
      ? `no empreendimento "${c.development.name}", ${c.development.city}.`
      : 'para campanha institucional / marca (use o título da campanha como referência).';
    let refNote = '';
    if (dto.referenceAssetId) {
      const ref = c.assets.find((a) => a.id === dto.referenceAssetId);
      if (ref) refNote = ' Use como referência visual a composição/cores da imagem já selecionada na campanha.';
    }
    const prompt = [
      `Criar imagem promocional em português (Brasil) para ${lotLine} ${devLine}`,
      `Estilo: ${style}. Objetivo: divulgação imobiliária de alta conversão.`,
      `Formato mental: ${platform} (${this.aspectHintForPlatform(platform)}).`,
      'Qualidade profissional, tipografia legível, sensação de oportunidade e confiança.',
      refNote,
    ]
      .filter(Boolean)
      .join(' ');
    return { prompt, provider: this.imageProvider.name };
  }

  async generateAiImages(userId: string, role: UserRole, campaignId: string, dto: GenerateAiImageDto) {
    const c = await this.assertCampaignOwner(userId, role, campaignId);
    const count = dto.variationCount === 4 ? 4 : dto.variationCount === 1 ? 1 : 2;

    let referenceUrls: string[] | undefined;
    if (dto.referenceAssetId) {
      const ref = c.assets.find((a) => a.id === dto.referenceAssetId);
      if (ref) referenceUrls = [ref.url];
    }

    const primaryTarget =
      c.targets.find((t) => t.platform === 'INSTAGRAM_FEED') ?? c.targets[0];
    const platform = primaryTarget?.platform ?? 'INSTAGRAM_FEED';
    const { w, h } = this.pixelSizeForPlatform(platform);

    const job = await this.prisma.aiImageGenerationJob.create({
      data: {
        campaignId,
        provider: this.imageProvider.name,
        prompt: dto.prompt,
        status: AiImageJobStatus.PROCESSING,
      },
    });

    try {
      const results = await this.imageProvider.generate({
        prompt: dto.prompt,
        width: w,
        height: h,
        count,
        referenceUrls,
      });

      const start = await this.prisma.campaignAsset.count({ where: { campaignId } });
      const assets = await this.prisma.$transaction(
        results.map((r, i) =>
          this.prisma.campaignAsset.create({
            data: {
              campaignId,
              kind: CampaignAssetKind.GENERATED_IMAGE,
              origin: CampaignAssetOrigin.AI,
              url: r.url,
              publicId: r.publicId ?? null,
              fileName: `ai-${job.id}-${i + 1}.png`,
              mimeType: 'image/png',
              sortOrder: start + i,
              isPrimary: false,
            },
          }),
        ),
      );

      await this.prisma.aiImageGenerationJob.update({
        where: { id: job.id },
        data: {
          status: AiImageJobStatus.COMPLETED,
          resultUrl: results[0]?.url ?? null,
          resultPublicId: results[0]?.publicId ?? null,
        },
      });

      return { jobId: job.id, assets, provider: this.imageProvider.name };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.aiImageGenerationJob.update({
        where: { id: job.id },
        data: { status: AiImageJobStatus.FAILED, errorMessage: msg },
      });
      throw e;
    }
  }

  private pixelSizeForPlatform(platform: PublicationPlatform): { w: number; h: number } {
    switch (platform) {
      case 'INSTAGRAM_STORY':
      case 'INSTAGRAM_REEL':
        return { w: 1080, h: 1920 };
      case 'INSTAGRAM_FEED':
        return { w: 1080, h: 1350 };
      default:
        return { w: 1080, h: 1080 };
    }
  }
}
