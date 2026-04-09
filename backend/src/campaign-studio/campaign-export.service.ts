import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignPublisherService } from './campaign-publisher.service';
import type { InstagramAdPack } from '../instagram-ads/instagram-ads.engine';

@Injectable()
export class CampaignExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: CampaignPublisherService,
  ) {}

  async buildExportBundle(campaignId: string) {
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: {
        assets: { orderBy: { sortOrder: 'asc' } },
        copies: true,
        targets: true,
        development: { select: { name: true, city: true, state: true } },
        lot: { select: { number: true } },
      },
    });
    if (!campaign) return null;

    const pack = campaign.packJson as InstagramAdPack | null;

    return {
      meta: {
        campaignId: campaign.id,
        title: campaign.title,
        status: campaign.status,
        development: campaign.development.name,
        city: campaign.development.city,
        lotNumber: campaign.lot?.number ?? null,
        generatedAt: campaign.lastGeneratedAt,
        publishingNote: this.publisher.readinessNote(),
      },
      pack,
      copies: campaign.copies,
      assets: campaign.assets.map((a) => ({
        id: a.id,
        url: a.url,
        origin: a.origin,
        kind: a.kind,
        isPrimary: a.isPrimary,
      })),
      targets: campaign.targets.map((t) => ({
        platform: t.platform,
        status: t.status,
        autoPublish: this.publisher.autoPublishSupported(t.platform),
      })),
    };
  }
}
