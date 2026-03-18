import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { DevelopmentsService } from './developments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Controller('developments')
export class DevelopmentsController {
  constructor(private developments: DevelopmentsService) {}

  @Public()
  @Get()
  findAll() {
    return this.developments.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.developments.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  create(@Body() dto: { name: string; description?: string; address?: string; city: string; neighborhood?: string }) {
    return this.developments.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; address?: string; city?: string; neighborhood?: string },
  ) {
    return this.developments.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  delete(@Param('id') id: string) {
    return this.developments.delete(id);
  }
}
