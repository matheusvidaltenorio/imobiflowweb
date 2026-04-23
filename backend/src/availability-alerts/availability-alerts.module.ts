import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchingModule } from '../matching/matching.module';
import { AvailabilityChangeDetectionService } from './availability-change-detection.service';
import { AvailabilityAlertDispatchService } from './availability-alert-dispatch.service';

@Module({
  imports: [PrismaModule, MatchingModule],
  providers: [AvailabilityChangeDetectionService, AvailabilityAlertDispatchService],
  exports: [AvailabilityAlertDispatchService],
})
export class AvailabilityAlertsModule {}
