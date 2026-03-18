import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('installments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class InstallmentsController {
  constructor(private installments: InstallmentsService) {}

  @Get('payment/:paymentId')
  findByPayment(@Param('paymentId') paymentId: string, @CurrentUser('id') userId: string) {
    return this.installments.findByPayment(paymentId, userId);
  }

  @Patch(':id/pay')
  pay(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.installments.payInstallment(id, userId);
  }
}
