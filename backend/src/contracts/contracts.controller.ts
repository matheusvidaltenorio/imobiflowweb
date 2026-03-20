import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ContractsService } from './contracts.service';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class ContractsController {
  constructor(private contracts: ContractsService) {}

  @Post('from-proposal/:proposalId')
  createFromProposal(
    @Param('proposalId') proposalId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.contracts.createFromProposal(proposalId, userId, role);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.contracts.findAllForUser(userId, role === UserRole.ADMIN);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.contracts.findById(id, userId, role);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateContractStatusDto,
  ) {
    return this.contracts.updateStatus(id, userId, role, dto.status);
  }
}
