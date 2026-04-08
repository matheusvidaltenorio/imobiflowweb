import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CommercialAssistantService } from './commercial-assistant.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('commercial-assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class CommercialAssistantController {
  constructor(private readonly assistant: CommercialAssistantService) {}

  @Get('dashboard/messages')
  dashboardMessages(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.assistant.dashboardMessageRecommendations(userId, role);
  }

  @Post('leads/:leadId/suggestions')
  leadSuggestions(
    @Param('leadId') leadId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { regenerate?: boolean },
  ) {
    return this.assistant.generateForLead(leadId, userId, role, body);
  }

  @Post('lots/:lotId/suggestions')
  lotSuggestions(
    @Param('lotId') lotId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { regenerate?: boolean },
  ) {
    return this.assistant.generateForLot(lotId, userId, role, body);
  }
}
