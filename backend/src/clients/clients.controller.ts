import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class ClientsController {
  constructor(private clients: ClientsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.clients.findAllByBroker(userId, role === UserRole.ADMIN);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.clients.findById(id, userId, role === UserRole.ADMIN);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: { name: string; email: string; phone?: string; notes?: string },
  ) {
    return this.clients.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: { name?: string; email?: string; phone?: string; notes?: string },
  ) {
    return this.clients.update(id, userId, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.clients.delete(id, userId);
  }
}
