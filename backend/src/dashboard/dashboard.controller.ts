import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENTE, UserRole.CORRETOR, UserRole.ADMIN)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  getStats(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.dashboard.getStats(userId, role);
  }
}
