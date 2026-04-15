import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InstagramAdsModule } from '../instagram-ads/instagram-ads.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { SocialModule } from '../social/social.module';
import { CampaignStudioController } from './campaign-studio.controller';
import { CampaignStudioService } from './campaign-studio.service';
import { CampaignPublisherService } from './campaign-publisher.service';
import { CampaignExportService } from './campaign-export.service';
import { MockCampaignImageProvider } from './image-generation/mock-campaign-image.provider';
import { CAMPAIGN_IMAGE_PROVIDER } from './image-generation/campaign-image-provider.token';
import { GeminiCampaignTextService } from './gemini-campaign-text.service';
import { InstagramPublisherService } from './instagram-publisher.service';
import { FacebookPublisherService } from './facebook-publisher.service';
import { WhatsAppDistributionService } from './whatsapp-distribution.service';

@Module({
  imports: [PrismaModule, InstagramAdsModule, CloudinaryModule, SocialModule],
  controllers: [CampaignStudioController],
  providers: [
    CampaignStudioService,
    CampaignPublisherService,
    CampaignExportService,
    GeminiCampaignTextService,
    InstagramPublisherService,
    FacebookPublisherService,
    WhatsAppDistributionService,
    MockCampaignImageProvider,
    { provide: CAMPAIGN_IMAGE_PROVIDER, useExisting: MockCampaignImageProvider },
  ],
  exports: [CampaignStudioService, CampaignPublisherService, CampaignExportService],
})
export class CampaignStudioModule {}
