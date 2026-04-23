import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuditModule } from '../audit/audit.module';
import { GestoraModule } from '../gestora/gestora.module';
import { AvailabilityAlertsModule } from '../availability-alerts/availability-alerts.module';
import { DailyAvailabilityController } from './daily-availability.controller';
import { DailyAvailabilityService } from './daily-availability.service';
import { LotImageMapService } from './lot-image-map.service';
import { SpreadsheetParsingService } from './spreadsheet/spreadsheet-parsing.service';
import { SpreadsheetValidationService } from './spreadsheet/spreadsheet-validation.service';
import { SpreadsheetAvailabilityImportService } from './spreadsheet/spreadsheet-import.service';

@Module({
  imports: [PrismaModule, CloudinaryModule, AuditModule, GestoraModule, AvailabilityAlertsModule],
  controllers: [DailyAvailabilityController],
  providers: [
    DailyAvailabilityService,
    LotImageMapService,
    SpreadsheetParsingService,
    SpreadsheetValidationService,
    SpreadsheetAvailabilityImportService,
  ],
  exports: [DailyAvailabilityService, LotImageMapService, SpreadsheetAvailabilityImportService],
})
export class DailyAvailabilityModule {}
