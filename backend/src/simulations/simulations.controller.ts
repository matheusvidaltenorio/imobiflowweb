import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompareSimulationDto } from './dto/compare-simulation.dto';
import { SimulationsService } from './simulations.service';

@Controller('simulations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class SimulationsController {
  constructor(private simulations: SimulationsService) {}

  @Get('banks')
  listBanks() {
    return this.simulations.listBanks();
  }

  @Post('compare')
  compare(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CompareSimulationDto,
  ) {
    return this.simulations.compare(userId, role, dto);
  }
}
