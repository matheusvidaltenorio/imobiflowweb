import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { CommercialAssistantModule } from '../commercial-assistant/commercial-assistant.module';
import { InstagramAdsModule } from '../instagram-ads/instagram-ads.module';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [CommercialAssistantModule, InstagramAdsModule, MapsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
