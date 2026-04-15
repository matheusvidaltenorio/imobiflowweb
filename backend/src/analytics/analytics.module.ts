import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommercialAnalyticsService } from './commercial-analytics.service';
import { CommercialAnalyticsController } from './analytics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CommercialAnalyticsController],
  providers: [CommercialAnalyticsService],
  exports: [CommercialAnalyticsService],
})
export class AnalyticsModule {}
