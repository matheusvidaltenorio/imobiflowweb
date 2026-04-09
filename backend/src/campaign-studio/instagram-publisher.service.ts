import { Injectable } from '@nestjs/common';
import { PublicationPlatform } from '@prisma/client';
import { CampaignPublisherService } from './campaign-publisher.service';

/** Reservado para Instagram Graph API (Meta). Hoje: apenas exportação manual. */
@Injectable()
export class InstagramPublisherService {
  constructor(private readonly campaign: CampaignPublisherService) {}

  canAutoPublish(_platform: PublicationPlatform = 'INSTAGRAM_FEED'): boolean {
    return this.campaign.autoPublishSupported(_platform);
  }

  readinessNote(): string {
    return this.campaign.readinessNote();
  }
}
