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

function buildFacebookMessage(parts: Array<string | null | undefined>): string {
  return parts
    .map((s) => s?.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8000);
}

@Injectable()
export class FacebookPublisherService {
  private readonly log = new Logger(FacebookPublisherService.name);

  constructor(
    private readonly graph: MetaGraphService,
    private readonly connections: SocialConnectionService,
    private readonly prisma: PrismaService,
    private readonly integrationLog: SocialIntegrationLogService,
  ) {}

  /**
   * @param updateCampaignStatus default true — em publicação agendada (multi-canal), use false.
   */
  async publishPhotoPost(opts: {
    userId: string;
    role: UserRole;
    campaignId: string;
    socialConnectionId: string;
    updateCampaignStatus?: boolean;
  }): Promise<{ externalPostId: string; raw: Record<string, unknown> }> {
    const updateCampaignStatus = opts.updateCampaignStatus !== false;

    const { pageAccessToken, facebookPageId } = await this.connections.getDecryptedPageToken(
      opts.userId,
      opts.role,
      opts.socialConnectionId,
    );

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

    const target = campaign.targets.find((t) => t.platform === PublicationPlatform.FACEBOOK_POST);
    if (!target) {
      throw new BadRequestException(
        'A campanha não inclui o alvo “Facebook — post”. Edite a campanha e marque essa plataforma.',
      );
    }

    if (target.status === PublicationTargetStatus.PUBLISHED && target.externalPostId) {
      return {
        externalPostId: target.externalPostId,
        raw: { skipped: true, reason: 'already_published' },
      };
    }

    const primary = campaign.assets.find((a) => a.isPrimary) ?? campaign.assets[0];
    const copy = campaign.copies.find((c) => c.platform === PublicationPlatform.FACEBOOK_POST);

    const message = buildFacebookMessage([copy?.title, copy?.caption, copy?.cta, copy?.hashtags]);

    if (!message.trim()) {
      throw new BadRequestException('Gere o texto do Facebook antes de publicar.');
    }

    try {
      let raw: Record<string, unknown>;
      let externalPostId: string;

      if (primary?.url?.startsWith('https://')) {
        const photo = await this.graph.postPagePhoto({
          pageId: facebookPageId,
          pageAccessToken,
          imageUrl: primary.url.trim(),
          message,
        });
        externalPostId = photo.post_id ?? photo.id;
        raw = { photo } as Record<string, unknown>;
      } else {
        const feed = await this.graph.postPageFeed({
          pageId: facebookPageId,
          pageAccessToken,
          message,
        });
        externalPostId = feed.id;
        raw = { feed } as Record<string, unknown>;
      }

      await this.prisma.campaignPublicationTarget.update({
        where: {
          campaignId_platform: {
            campaignId: opts.campaignId,
            platform: PublicationPlatform.FACEBOOK_POST,
          },
        },
        data: {
          status: PublicationTargetStatus.PUBLISHED,
          publishedAt: new Date(),
          externalPostId,
          externalContainerId: null,
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
        channel: 'FACEBOOK_POST',
        campaignId: opts.campaignId,
        socialConnectionId: opts.socialConnectionId,
        status: 'SUCCESS',
        externalId: externalPostId,
        metadataJson: { facebookPageId },
      });

      return { externalPostId, raw };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido na Graph API';
      this.log.warn(`Facebook publish failed: ${msg}`);
      await this.prisma.campaignPublicationTarget.update({
        where: {
          campaignId_platform: {
            campaignId: opts.campaignId,
            platform: PublicationPlatform.FACEBOOK_POST,
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
        channel: 'FACEBOOK_POST',
        campaignId: opts.campaignId,
        socialConnectionId: opts.socialConnectionId,
        status: 'FAILED',
        message: msg.slice(0, 2000),
      });
      throw new BadRequestException(
        `Não foi possível publicar no Facebook. ${msg} — Verifique permissões da página e do token.`,
      );
    }
  }
}
