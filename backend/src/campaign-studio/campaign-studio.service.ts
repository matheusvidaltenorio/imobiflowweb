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
  Prisma,
  PublicationPlatform,
  PublicationTargetStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InstagramAdsService } from '../instagram-ads/instagram-ads.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { buildCampaignCopyUpsertOperations } from './campaign-copy.mapper';
import { CampaignPublisherService } from './campaign-publisher.service';
import { CampaignExportService } from './campaign-export.service';
import { InstagramPublisherService } from './instagram-publisher.service';
import { FacebookPublisherService } from './facebook-publisher.service';
import { WhatsAppDistributionService } from './whatsapp-distribution.service';
import { MetaOAuthService } from '../social/meta-oauth.service';
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

const campaignDetailInclude = {
  assets: { orderBy: { sortOrder: 'asc' as const } },
  targets: true,
  copies: true,
  development: { select: { id: true, name: true, city: true, state: true, coverImage: true } },
  lot: { select: { id: true, number: true, block: { select: { name: true } } } },
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
    private readonly instagramPublisher: InstagramPublisherService,
    private readonly facebookPublisher: FacebookPublisherService,
    private readonly whatsappDistribution: WhatsAppDistributionService,
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
    await this.assertDevelopmentAccess(userId, role, c.developmentId);
    return c;
  }

  async create(userId: string, role: UserRole, dto: CreateCampaignDto) {
    await this.assertDevelopmentAccess(userId, role, dto.developmentId);

    const lotId = dto.lotId?.trim() || undefined;
    if (lotId) {
      const lot = await this.prisma.lot.findUnique({
        where: { id: lotId },
        select: { id: true, block: { select: { developmentId: true } } },
      });
      if (!lot) throw new NotFoundException('Lote não encontrado');
      if (lot.block.developmentId !== dto.developmentId) {
        throw new ForbiddenException('Lote não pertence a este loteamento.');
      }
    }

    const status = this.publisher.defaultTargetStatus();

    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.marketingCampaign.create({
        data: {
          userId,
          developmentId: dto.developmentId,
          lotId: lotId ?? null,
          title: dto.title.trim(),
          objective: dto.objective ?? undefined,
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
    await this.assertCampaignOwner(userId, role, campaignId);

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

    const connectionId = dto.socialConnectionId?.trim();
    if (!connectionId) {
      throw new BadRequestException('Informe a conexão Meta (socialConnectionId) da página a publicar.');
    }

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

  async list(userId: string, role: UserRole, developmentId?: string) {
    const where: Prisma.MarketingCampaignWhereInput = {
      ...(developmentId ? { developmentId } : {}),
      ...(role === UserRole.ADMIN ? {} : { userId }),
    };
    return this.prisma.marketingCampaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        development: { select: { name: true, city: true } },
        lot: { select: { number: true } },
        _count: { select: { assets: true, copies: true } },
      },
    });
  }

  async getById(userId: string, role: UserRole, id: string) {
    return this.assertCampaignOwner(userId, role, id);
  }

  async update(userId: string, role: UserRole, id: string, dto: UpdateCampaignDto) {
    await this.assertCampaignOwner(userId, role, id);
    return this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
        ...(dto.objective != null ? { objective: dto.objective } : {}),
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
          lotId: src.lotId,
          title: newTitle,
          objective: src.objective,
          status: 'DRAFT',
          primaryContentType: src.primaryContentType,
          packJson: src.packJson ?? undefined,
          lastGeneratedAt: src.lastGeneratedAt ?? undefined,
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
    let refNote = '';
    if (dto.referenceAssetId) {
      const ref = c.assets.find((a) => a.id === dto.referenceAssetId);
      if (ref) refNote = ' Use como referência visual a composição/cores da imagem já selecionada na campanha.';
    }
    const prompt = [
      `Criar imagem promocional em português (Brasil) para ${lotLine} no empreendimento "${c.development.name}", ${c.development.city}.`,
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
