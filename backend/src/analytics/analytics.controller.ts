import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CommercialAnalyticsService } from './commercial-analytics.service';
import { CommercialAnalyticsQueryDto } from './dto/commercial-analytics-query.dto';

@Controller('analytics/commercial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class CommercialAnalyticsController {
  constructor(private readonly commercial: CommercialAnalyticsService) {}

  @Get()
  getDashboard(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query() query: CommercialAnalyticsQueryDto,
  ) {
    return this.commercial.getCommercialDashboard(userId, role, query);
  }
}
