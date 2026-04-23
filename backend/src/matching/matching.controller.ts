import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MatchSuggestionService } from './match-suggestion.service';
import { InterestProfileService } from './interest-profile.service';

@Controller('matching')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class MatchingController {
  constructor(
    private readonly suggestions: MatchSuggestionService,
    private readonly interest: InterestProfileService,
  ) {}

  @Get('leads/:leadId/suggestions')
  list(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('leadId') leadId: string) {
    return this.suggestions.listForLead(userId, role, leadId);
  }

  @Post('leads/:leadId/refresh')
  refresh(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('leadId') leadId: string) {
    return this.suggestions.refreshForLead(userId, role, leadId);
  }

  @Get('leads/:leadId/interest-profile')
  getProfile(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole, @Param('leadId') leadId: string) {
    return this.interest.getForLead(userId, role, leadId);
  }

  @Put('leads/:leadId/interest-profile')
  putProfile(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('leadId') leadId: string,
    @Body()
    body: {
      budgetMin?: number | null;
      budgetMax?: number | null;
      preferredDevelopmentIds?: string[];
      preferredRegions?: string[];
      minArea?: number | null;
      maxArea?: number | null;
      propertyIntent?: 'MORAR' | 'INVESTIR' | 'OUTRO' | null;
      financingNotes?: string | null;
      mustHaveTags?: string[];
      niceToHaveTags?: string[];
      urgencyLevel?: string | null;
      extraJson?: Prisma.InputJsonValue;
    },
  ) {
    return this.interest.upsertForLead(userId, role, leadId, body);
  }
}
