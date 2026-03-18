import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { LotsService } from './lots.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Controller('lots')
export class LotsController {
  constructor(private lots: LotsService) {}

  @Public()
  @Get('block/:blockId')
  findByBlock(@Param('blockId') blockId: string) {
    return this.lots.findByBlock(blockId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.lots.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  create(
    @Body() dto: { blockId: string; number: string; area?: number; price?: number; status?: string },
  ) {
    return this.lots.create(dto.blockId, dto as Parameters<LotsService['create']>[1]);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: { number?: string; area?: number; price?: number; status?: string }) {
    return this.lots.update(id, dto as Parameters<LotsService['update']>[1]);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  delete(@Param('id') id: string) {
    return this.lots.delete(id);
  }
}
