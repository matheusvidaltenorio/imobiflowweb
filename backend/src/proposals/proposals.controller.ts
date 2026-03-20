import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';
import { UpdateProposalLinksDto } from './dto/update-proposal-links.dto';
import { ProposalsService } from './proposals.service';

@Controller('proposals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class ProposalsController {
  constructor(private proposals: ProposalsService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateProposalDto,
  ) {
    return this.proposals.create(userId, role, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.proposals.findAllForUser(userId, role === UserRole.ADMIN);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateProposalStatusDto,
  ) {
    return this.proposals.updateStatus(id, userId, role, dto.status);
  }

  @Patch(':id/links')
  updateLinks(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: UpdateProposalLinksDto,
  ) {
    return this.proposals.updateProposalLinks(id, userId, role, dto);
  }
}
