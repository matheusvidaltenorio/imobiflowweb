import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  InstagramAdsService,
  type GenerateInstagramAdsDto,
} from './instagram-ads.service';

@Controller('instagram-ads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class InstagramAdsController {
  constructor(private readonly ads: InstagramAdsService) {}

  @Get('dashboard/recommendations')
  recommendations(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.ads.getDashboardRecommendations(userId, role);
  }

  @Post('lots/:lotId/generate')
  generateForLot(
    @Param('lotId') lotId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: GenerateInstagramAdsDto,
  ) {
    return this.ads.generateForLot(userId, role, lotId, body ?? {});
  }

  @Post('developments/:developmentId/generate')
  generateForDevelopment(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: GenerateInstagramAdsDto,
  ) {
    return this.ads.generateForDevelopment(userId, role, developmentId, body ?? {});
  }
}
