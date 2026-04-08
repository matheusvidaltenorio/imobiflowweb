import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LotsService } from './lots.service';
import { LotScoringService } from '../lot-scoring/lot-scoring.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Controller('lots')
export class LotsController {
  constructor(
    private lots: LotsService,
    private scoring: LotScoringService,
  ) {}

  @Public()
  @Get('block/:blockId')
  findByBlock(@Param('blockId') blockId: string) {
    return this.lots.findByBlock(blockId);
  }

  @Public()
  @Get('development/:developmentId/map')
  mapByDevelopment(@Param('developmentId') developmentId: string) {
    return this.lots.findMapByDevelopment(developmentId);
  }

  @Public()
  @Post(':id/view')
  trackView(@Param('id') id: string) {
    return this.lots.incrementView(id);
  }

  @Get('ranking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  ranking(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('developmentId') developmentId?: string,
    @Query('filter') filter?: string,
  ) {
    return this.scoring.findRanking(userId, role, { developmentId, filter });
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
    @Body()
    dto: {
      blockId: string;
      number: string;
      area?: number;
      price?: number;
      status?: string;
      latitude?: number;
      longitude?: number;
      polygonCoordinates?: unknown;
      mapLabel?: string;
      referencePoint?: string;
      streetFront?: string;
    },
  ) {
    return this.lots.create(dto.blockId, dto as Parameters<LotsService['create']>[1]);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      number?: string;
      area?: number;
      price?: number;
      status?: string;
      manualHighlight?: boolean;
      latitude?: number | null;
      longitude?: number | null;
      polygonCoordinates?: unknown | null;
      mapLabel?: string | null;
      referencePoint?: string | null;
      streetFront?: string | null;
    },
  ) {
    return this.lots.update(id, dto as Parameters<LotsService['update']>[1]);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  delete(@Param('id') id: string) {
    return this.lots.delete(id);
  }
}
