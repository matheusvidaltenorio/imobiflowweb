import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { PortalHubService } from './portal-hub.service';
import { PortalHubController } from './portal-hub.controller';
import { PortalConnectorFactory } from './portal-connector.factory';
import { ExternalPortalLeadService } from './external-portal-lead.service';
import { PortalAnalyticsService } from './portal-analytics.service';

@Module({
  imports: [PrismaModule, AuditModule, LeadsModule],
  controllers: [PortalHubController],
  providers: [PortalHubService, PortalConnectorFactory, ExternalPortalLeadService, PortalAnalyticsService],
  exports: [PortalHubService, PortalAnalyticsService],
})
export class PortalHubModule {}
