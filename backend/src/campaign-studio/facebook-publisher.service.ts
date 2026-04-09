import { Injectable } from '@nestjs/common';
import { PublicationPlatform } from '@prisma/client';
import { CampaignPublisherService } from './campaign-publisher.service';

/** Reservado para Facebook Pages API (Meta). Hoje: apenas exportação manual. */
@Injectable()
export class FacebookPublisherService {
  constructor(private readonly campaign: CampaignPublisherService) {}

  canAutoPublish(_platform: PublicationPlatform = 'FACEBOOK_POST'): boolean {
    return this.campaign.autoPublishSupported(_platform);
  }

  readinessNote(): string {
    return this.campaign.readinessNote();
  }
}
