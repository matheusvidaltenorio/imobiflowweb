import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GestoraAccessService } from './gestora-access.service';

@Controller('gestora')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GestoraController {
  constructor(private readonly gestoraAccess: GestoraAccessService) {}

  /** Loteamentos vinculados à conta (escopo operacional). */
  @Get('my-developments')
  @Roles(UserRole.GESTORA)
  myDevelopments(@CurrentUser('id') userId: string) {
    return this.gestoraAccess.listForUser(userId);
  }
}
