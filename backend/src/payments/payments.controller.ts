import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.payments.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.payments.findById(id, userId);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: {
      description: string;
      totalAmount: number;
      dueDate?: string;
      installments: { amount: number; dueDate: string }[];
    },
  ) {
    return this.payments.create(userId, {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      installments: dto.installments.map((i) => ({ ...i, dueDate: new Date(i.dueDate) })),
    });
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { status: string },
  ) {
    return this.payments.updateStatus(id, userId, body.status as import('@prisma/client').PaymentStatus);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.payments.delete(id, userId);
  }
}
