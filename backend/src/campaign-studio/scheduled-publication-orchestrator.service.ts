import { HttpException, Injectable, Logger } from '@nestjs/common';
import {
  MarketingCampaignStatus,
  Prisma,
  PublicationPlatform,
  PublicationTargetStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SocialConnectionService } from '../social/social-connection.service';
import { CampaignPublicationOpLogService } from './campaign-publication-op-log.service';
import { FacebookPublisherService } from './facebook-publisher.service';
import { InstagramPublisherService } from './instagram-publisher.service';
import { computeNextRetryAt, isRecoverablePublicationError } from './publication-error-classifier';

function httpMessage(e: unknown): string {
  if (e instanceof HttpException) {
    const r = e.getResponse();
    if (typeof r === 'string') return r;
    if (typeof r === 'object' && r && 'message' in r) {
      const m = (r as { message?: string | string[] }).message;
      if (Array.isArray(m)) return m.join(', ');
      if (typeof m === 'string') return m;
    }
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

@Injectable()
export class ScheduledPublicationOrchestratorService {
  private readonly log = new Logger(ScheduledPublicationOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialConnections: SocialConnectionService,
    private readonly instagram: InstagramPublisherService,
    private readonly facebook: FacebookPublisherService,
    private readonly opLog: CampaignPublicationOpLogService,
  ) {}

  private resolveChannels(campaign: {
    scheduledChannelsJson: Prisma.JsonValue | null;
    targets: { platform: PublicationPlatform }[];
  }): PublicationPlatform[] {
    const raw = campaign.scheduledChannelsJson;
    if (Array.isArray(raw) && raw.length) {
      const list = raw.filter(
        (x): x is PublicationPlatform =>
          x === PublicationPlatform.INSTAGRAM_FEED || x === PublicationPlatform.FACEBOOK_POST,
      );
      if (list.length) return list;
    }
    return campaign.targets
      .filter(
        (t) =>
          t.platform === PublicationPlatform.INSTAGRAM_FEED ||
          t.platform === PublicationPlatform.FACEBOOK_POST,
      )
      .map((t) => t.platform);
  }

  /**
   * Executa publicação automática (worker já definiu status PROCESSING e lock).
   */
  async execute(campaignId: string): Promise<void> {
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: { targets: true, user: { select: { role: true } } },
    });
    if (!campaign) {
      this.log.warn(`Campanha ${campaignId} não encontrada`);
      return;
    }

    if (campaign.status !== MarketingCampaignStatus.PROCESSING) {
      this.log.warn(`Campanha ${campaignId} não está em PROCESSING (é ${campaign.status}), ignorando.`);
      return;
    }

    const userId = campaign.userId;
    const role = campaign.user.role;
    const attemptNo = campaign.retryCount + 1;

    const channels = this.resolveChannels(campaign);
    if (!channels.length) {
      await this.failPermanent(
        campaignId,
        userId,
        attemptNo,
        'Nenhum canal Instagram/Facebook configurado para publicação automática.',
      );
      return;
    }

    let connectionId: string;
    try {
      connectionId = await this.socialConnections.resolveConnectionIdForPublishing(
        userId,
        role,
        campaign.scheduledSocialConnectionId ?? undefined,
      );
    } catch (e) {
      const msg = httpMessage(e);
      await this.failPermanent(campaignId, userId, attemptNo, msg);
      return;
    }

    await this.opLog.log({
      campaignId,
      userId,
      action: 'PROCESSING_STARTED',
      status: 'RUNNING',
      message: `Canais: ${channels.join(', ')}`,
      attemptNumber: attemptNo,
      metadataJson: { channels, connectionId },
    });

    const errors: string[] = [];

    for (const platform of channels) {
      try {
        if (platform === PublicationPlatform.INSTAGRAM_FEED) {
          await this.instagram.publishFeed({
            userId,
            role,
            campaignId,
            socialConnectionId: connectionId,
            updateCampaignStatus: false,
          });
        } else if (platform === PublicationPlatform.FACEBOOK_POST) {
          await this.facebook.publishPhotoPost({
            userId,
            role,
            campaignId,
            socialConnectionId: connectionId,
            updateCampaignStatus: false,
          });
        }
      } catch (e) {
        errors.push(httpMessage(e));
      }
    }

    const refreshed = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: { targets: true },
    });
    if (!refreshed) return;

    const allPublished = channels.every((pl) => {
      const t = refreshed.targets.find((x) => x.platform === pl);
      return t?.status === PublicationTargetStatus.PUBLISHED;
    });

    if (allPublished) {
      await this.prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          status: MarketingCampaignStatus.PUBLISHED,
          campaignPublishedAt: new Date(),
          publicationLockUntil: null,
          publishFailureReason: null,
          nextRetryAt: null,
          retryCount: 0,
        },
      });
      await this.opLog.log({
        campaignId,
        userId,
        action: 'PUBLISH_SUCCESS',
        status: 'SUCCESS',
        message: 'Todos os canais publicados.',
        attemptNumber: attemptNo,
      });
      return;
    }

    const joined = errors.join(' | ') || 'Falha em um ou mais canais.';
    const recoverable =
      errors.length > 0 && errors.every((m) => isRecoverablePublicationError(m));
    const canRetry =
      campaign.autoRetryEnabled && campaign.retryCount < campaign.maxRetries && recoverable;

    if (canRetry) {
      const next = computeNextRetryAt(campaign.retryCount);
      await this.prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          status: MarketingCampaignStatus.RETRYING,
          retryCount: campaign.retryCount + 1,
          nextRetryAt: next,
          publishFailureReason: joined.slice(0, 4000),
          publicationLockUntil: null,
        },
      });
      await this.opLog.log({
        campaignId,
        userId,
        action: 'RETRY_SCHEDULED',
        status: 'PENDING',
        message: joined.slice(0, 2000),
        attemptNumber: attemptNo,
        metadataJson: { nextRetryAt: next.toISOString() },
      });
      return;
    }

    await this.prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: MarketingCampaignStatus.FAILED,
        publishFailureReason: joined.slice(0, 4000),
        publicationLockUntil: null,
        nextRetryAt: null,
      },
    });
    await this.opLog.log({
      campaignId,
      userId,
      action: 'PUBLISH_FAILED',
      status: 'FAILED',
      message: joined.slice(0, 2000),
      attemptNumber: attemptNo,
    });
  }

  private async failPermanent(campaignId: string, userId: string, attemptNo: number, message: string) {
    await this.prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: MarketingCampaignStatus.FAILED,
        publishFailureReason: message.slice(0, 4000),
        publicationLockUntil: null,
        nextRetryAt: null,
      },
    });
    await this.opLog.log({
      campaignId,
      userId,
      action: 'PUBLISH_FAILED',
      status: 'FAILED',
      message: message.slice(0, 2000),
      attemptNumber: attemptNo,
    });
  }
}
