import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ClosingPredictionService } from './closing-prediction.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('closing-prediction')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class ClosingPredictionController {
  constructor(private readonly closing: ClosingPredictionService) {}

  @Get('leads/:leadId/history')
  history(
    @Param('leadId') leadId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.closing.getHistory(leadId, userId, role);
  }
}
