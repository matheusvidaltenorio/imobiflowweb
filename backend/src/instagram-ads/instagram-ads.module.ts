import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LotScoringModule } from '../lot-scoring/lot-scoring.module';
import { InstagramAdsController } from './instagram-ads.controller';
import { InstagramAdsService } from './instagram-ads.service';
import { InstagramPublishingService } from './instagram-publishing.stub';

@Module({
  imports: [PrismaModule, LotScoringModule],
  controllers: [InstagramAdsController],
  providers: [InstagramAdsService, InstagramPublishingService],
  exports: [InstagramAdsService],
})
export class InstagramAdsModule {}
