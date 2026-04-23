import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { LeadsService, type CommercialLeadAction, type LeadsListFilters } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole, LeadStatus } from '@prisma/client';

const LEAD_STATUSES: Set<string> = new Set([
  'NOVO_LEAD',
  'EM_ATENDIMENTO',
  'VISITA_AGENDADA',
  'PROPOSTA_ENVIADA',
  'RESERVADO',
  'VENDIDO',
  'PERDIDO',
]);

function parseLeadStatus(s?: string): LeadStatus | undefined {
  if (!s || !LEAD_STATUSES.has(s)) return undefined;
  return s as LeadStatus;
}

@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Public()
  @Post()
  create(
    @Body()
    dto: {
      propertyId?: string;
      lotId?: string;
      developmentId?: string;
      marketingCampaignId?: string;
      name: string;
      email: string;
      phone?: string;
      message?: string;
      source?: string;
      leadSource?: string;
    },
    @Req() req: { user?: { id: string }; ip?: string },
  ) {
    return this.leads.create(
      {
        ...dto,
        userId: req.user?.id,
      },
      req.ip,
    );
  }

  @Public()
  @Post(':id/touch')
  touch(@Param('id') id: string, @Req() req: { ip?: string }) {
    return this.leads.recordPublicTouch(id, req.ip);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('sort') sort?: string,
    @Query('status') status?: string,
    @Query('developmentId') developmentId?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('leadSource') leadSource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('priority') priority?: string,
  ) {
    const s =
      sort === 'closing' || sort === 'risk' || sort === 'recent'
        ? sort
        : undefined;
    const filters: LeadsListFilters = {
      status: parseLeadStatus(status),
      developmentId: developmentId || undefined,
      assignedUserId: assignedUserId || undefined,
      leadSource: leadSource || undefined,
      from: from || undefined,
      to: to || undefined,
      priority: priority === 'hot' || priority === 'stale' ? priority : undefined,
    };
    return this.leads.findAllByUser(userId, role, s, filters);
  }

  @Post(':id/interactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  addInteraction(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { type: string; notes?: string },
  ) {
    return this.leads.addInteraction(id, userId, role, body);
  }

  @Post(':id/commercial-action')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  commercialAction(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { action: CommercialLeadAction; lostReason?: string },
  ) {
    return this.leads.commercialAction(id, userId, role, body.action, {
      lostReason: body.lostReason,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  patchLead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body()
    body: {
      notes?: string | null;
      nextFollowUpAt?: string | null;
      developmentId?: string | null;
      assignedUserId?: string | null;
      clientId?: string | null;
      lostReason?: string | null;
    },
  ) {
    return this.leads.patchLead(id, userId, role, body);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.leads.findById(id, userId, role);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { status: string },
  ) {
    return this.leads.updateStatus(id, userId, role, body.status as LeadStatus);
  }
}
