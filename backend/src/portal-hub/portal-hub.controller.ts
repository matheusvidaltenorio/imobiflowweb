import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PortalCode, PortalListingLifecycleStatus, Prisma, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PortalHubService } from './portal-hub.service';
import { ExternalPortalLeadService } from './external-portal-lead.service';
import { PortalAnalyticsService } from './portal-analytics.service';

@Controller('portal-hub')
export class PortalHubController {
  constructor(
    private readonly hub: PortalHubService,
    private readonly externalLead: ExternalPortalLeadService,
    private readonly analytics: PortalAnalyticsService,
  ) {}

  @Get('listings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  listings(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('portal') portal?: PortalCode,
    @Query('status') status?: PortalListingLifecycleStatus,
  ) {
    return this.hub.listListings(userId, role, { portal, status });
  }

  @Post('listings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  createDraft(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      lotId?: string;
      propertyId?: string;
      portal: PortalCode;
      title?: string;
      description?: string;
      price?: number;
    },
  ) {
    return this.hub.createDraft(userId, body);
  }

  @Post('listings/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  publish(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('id') id: string) {
    return this.hub.publish(userId, role, id);
  }

  @Post('listings/:id/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  sync(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('id') id: string) {
    return this.hub.sync(userId, role, id);
  }

  @Get('connectors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  connectors(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.hub.connectorConfigs(userId, role);
  }

  @Put('connectors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  putConnector(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body()
    body: {
      portal: PortalCode;
      label: string;
      credentialsEnvKey?: string;
      enabled?: boolean;
      metadataJson?: Prisma.InputJsonValue;
    },
  ) {
    return this.hub.upsertConnectorConfig(userId, role, body);
  }

  @Get('analytics/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  analyticsSummary(
    @Query('portal') portal?: PortalCode,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.summary({
      portal,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Public()
  @Post('webhooks/:portal/leads')
  webhook(
    @Param('portal') portal: PortalCode,
    @Body()
    body: {
      externalLeadId: string;
      listingReference?: string;
      name: string;
      email: string;
      phone?: string;
      message?: string;
      propertyId?: string;
      lotId?: string;
      developmentId?: string;
    },
  ) {
    return this.externalLead.ingest({
      portal,
      externalLeadId: body.externalLeadId,
      listingReference: body.listingReference,
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
      propertyId: body.propertyId,
      lotId: body.lotId,
      developmentId: body.developmentId,
      rawPayload: body,
    });
  }
}
