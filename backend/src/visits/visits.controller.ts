import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private visits: VisitsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  findAll(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.visits.findAllByUser(userId, role);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.visits.findById(id, userId, role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: { propertyId: string; clientId?: string; leadId?: string; scheduledAt: string; notes?: string },
  ) {
    return this.visits.create(userId, { ...dto, scheduledAt: new Date(dto.scheduledAt) });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: { scheduledAt?: string; status?: string; notes?: string },
  ) {
    return this.visits.update(id, userId, role, {
      ...dto,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      status: dto.status as import('@prisma/client').VisitStatus | undefined,
    });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  delete(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.visits.delete(id, userId, role);
  }
}
