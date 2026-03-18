import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Public()
  @Post()
  create(
    @Body() dto: { propertyId: string; name: string; email: string; phone?: string; message?: string; source?: string },
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

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  findAll(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.leads.findAllByUser(userId, role);
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
    return this.leads.updateStatus(id, userId, role, body.status as import('@prisma/client').LeadStatus);
  }
}
