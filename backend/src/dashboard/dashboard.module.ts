import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { CommercialAssistantModule } from '../commercial-assistant/commercial-assistant.module';
import { InstagramAdsModule } from '../instagram-ads/instagram-ads.module';

@Module({
  imports: [CommercialAssistantModule, InstagramAdsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
