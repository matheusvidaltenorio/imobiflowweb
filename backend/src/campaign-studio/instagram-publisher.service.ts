import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  MarketingCampaignStatus,
  Prisma,
  PublicationPlatform,
  PublicationTargetStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetaGraphService } from '../social/meta-graph.service';
import { SocialConnectionService } from '../social/social-connection.service';
import { SocialIntegrationLogService } from '../social/social-integration-log.service';

function buildInstagramCaption(parts: Array<string | null | undefined>): string {
  return parts
    .map((s) => s?.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 2200);
}

@Injectable()
export class InstagramPublisherService {
  private readonly log = new Logger(InstagramPublisherService.name);

  constructor(
    private readonly graph: MetaGraphService,
    private readonly connections: SocialConnectionService,
    private readonly prisma: PrismaService,
    private readonly integrationLog: SocialIntegrationLogService,
  ) {}

  /**
   * Publica um post de feed (imagem + legenda) via Instagram Graph API.
   * Story/Reel não usam este fluxo (mídia em vídeo / requisitos diferentes).
   * @param updateCampaignStatus default true — em publicação agendada (multi-canal), use false e o orquestrador define o status final.
   */
  async publishFeed(opts: {
    userId: string;
    role: UserRole;
    campaignId: string;
    socialConnectionId: string;
    updateCampaignStatus?: boolean;
  }): Promise<{
    externalPostId: string;
    externalContainerId: string;
    raw: Record<string, unknown>;
  }> {
    const updateCampaignStatus = opts.updateCampaignStatus !== false;

    const { pageAccessToken, instagramUserId } = await this.connections.getDecryptedPageToken(
      opts.userId,
      opts.role,
      opts.socialConnectionId,
    );
    if (!instagramUserId) {
      throw new BadRequestException(
        'Esta página do Facebook não possui conta Instagram Business vinculada. Vincule o Instagram à página no Meta Business Suite e reconecte.',
      );
    }

    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: opts.campaignId },
      include: {
        assets: { orderBy: { sortOrder: 'asc' } },
        copies: true,
        targets: true,
      },
    });
    if (!campaign) {
      throw new BadRequestException('Campanha não encontrada');
    }

    const target = campaign.targets.find((t) => t.platform === PublicationPlatform.INSTAGRAM_FEED);
    if (!target) {
      throw new BadRequestException(
        'A campanha não inclui o alvo “Instagram — feed”. Edite a campanha e marque essa plataforma.',
      );
    }

    if (target.status === PublicationTargetStatus.PUBLISHED && target.externalPostId) {
      return {
        externalPostId: target.externalPostId,
        externalContainerId: target.externalContainerId ?? '',
        raw: { skipped: true, reason: 'already_published' },
      };
    }

    const primary = campaign.assets.find((a) => a.isPrimary) ?? campaign.assets[0];
    if (!primary) {
      throw new BadRequestException('Adicione pelo menos uma imagem (capa) antes de publicar.');
    }
    const imageUrl = primary.url.trim();
    if (!imageUrl.startsWith('https://')) {
      throw new BadRequestException(
        'A Meta exige URL HTTPS pública para a imagem. Verifique se o upload/banco gera link seguro.',
      );
    }

    const copy = campaign.copies.find((c) => c.platform === PublicationPlatform.INSTAGRAM_FEED);
    const caption = buildInstagramCaption([
      copy?.title,
      copy?.caption,
      copy?.cta,
      copy?.hashtags,
    ]);

    if (!caption) {
      throw new BadRequestException('Gere o texto da campanha (legenda Instagram) antes de publicar.');
    }

    try {
      const created = await this.graph.createInstagramMedia({
        igUserId: instagramUserId,
        pageAccessToken,
        imageUrl,
        caption,
      });
      const published = await this.graph.publishInstagramMedia({
        igUserId: instagramUserId,
        pageAccessToken,
        creationId: created.id,
      });
      const raw = {
        creation: created,
        publish: published,
      } as Record<string, unknown>;

      await this.prisma.campaignPublicationTarget.update({
        where: {
          campaignId_platform: {
            campaignId: opts.campaignId,
            platform: PublicationPlatform.INSTAGRAM_FEED,
          },
        },
        data: {
          status: PublicationTargetStatus.PUBLISHED,
          publishedAt: new Date(),
          externalPostId: published.id,
          externalContainerId: created.id,
          publishError: null,
          rawResponseJson: raw as Prisma.InputJsonValue,
        },
      });

      if (updateCampaignStatus) {
        await this.prisma.marketingCampaign.update({
          where: { id: opts.campaignId },
          data: { status: MarketingCampaignStatus.PUBLISHED },
        });
      }

      await this.integrationLog.log({
        userId: opts.userId,
        action: 'CAMPAIGN_PUBLISHED',
        channel: 'INSTAGRAM_FEED',
        campaignId: opts.campaignId,
        socialConnectionId: opts.socialConnectionId,
        status: 'SUCCESS',
        externalId: published.id,
        metadataJson: { instagramUserId },
      });

      return {
        externalPostId: published.id,
        externalContainerId: created.id,
        raw,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido na Graph API';
      this.log.warn(`Instagram publish failed: ${msg}`);
      await this.prisma.campaignPublicationTarget.update({
        where: {
          campaignId_platform: {
            campaignId: opts.campaignId,
            platform: PublicationPlatform.INSTAGRAM_FEED,
          },
        },
        data: {
          status: PublicationTargetStatus.FAILED,
          publishError: msg,
          rawResponseJson: { error: msg } as Prisma.InputJsonValue,
        },
      });
      if (updateCampaignStatus) {
        await this.prisma.marketingCampaign.update({
          where: { id: opts.campaignId },
          data: { status: MarketingCampaignStatus.FAILED },
        });
      }
      await this.integrationLog.log({
        userId: opts.userId,
        action: 'CAMPAIGN_PUBLISH_FAILED',
        channel: 'INSTAGRAM_FEED',
        campaignId: opts.campaignId,
        socialConnectionId: opts.socialConnectionId,
        status: 'FAILED',
        message: msg.slice(0, 2000),
      });
      throw new BadRequestException(
        `Não foi possível publicar no Instagram. ${msg} — Verifique permissões, token e se a imagem é acessível publicamente.`,
      );
    }
  }
}
