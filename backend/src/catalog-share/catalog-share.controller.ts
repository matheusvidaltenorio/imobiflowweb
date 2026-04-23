import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CatalogShareService } from './catalog-share.service';

@Controller('catalog-share')
export class CatalogShareController {
  constructor(private readonly service: CatalogShareService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  list(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.service.listMine(userId, role);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { title: string; message?: string; leadId?: string; clientId?: string },
  ) {
    return this.service.create(userId, role, body);
  }

  @Put(':id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  setItems(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() body: { items: Array<{ lotId?: string; propertyId?: string; brokerNote?: string; sortOrder?: number }> },
  ) {
    return this.service.setItems(userId, role, id, body.items ?? []);
  }

  @Post(':id/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  send(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('id') id: string) {
    return this.service.markSent(userId, role, id);
  }

  @Public()
  @Get('public/:token')
  publicOne(@Param('token') token: string) {
    return this.service.getPublicByToken(token);
  }
}
