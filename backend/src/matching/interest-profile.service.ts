import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchSuggestionService } from './match-suggestion.service';

@Injectable()
export class InterestProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchSuggestions: MatchSuggestionService,
  ) {}

  private async assertLeadAccess(userId: string, role: UserRole, leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (role === UserRole.ADMIN) return lead;
    if (lead.userId === userId) return lead;
    throw new ForbiddenException();
  }

  async getForLead(userId: string, role: UserRole, leadId: string) {
    await this.assertLeadAccess(userId, role, leadId);
    return this.prisma.interestProfile.findUnique({ where: { leadId } });
  }

  async upsertForLead(
    userId: string,
    role: UserRole,
    leadId: string,
    dto: {
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
    await this.assertLeadAccess(userId, role, leadId);

    const profile = await this.prisma.interestProfile.upsert({
      where: { leadId },
      create: {
        leadId,
        budgetMin: dto.budgetMin != null ? new Prisma.Decimal(dto.budgetMin) : undefined,
        budgetMax: dto.budgetMax != null ? new Prisma.Decimal(dto.budgetMax) : undefined,
        preferredDevelopmentIds: dto.preferredDevelopmentIds ?? [],
        preferredRegions: dto.preferredRegions ?? [],
        minArea: dto.minArea != null ? new Prisma.Decimal(dto.minArea) : undefined,
        maxArea: dto.maxArea != null ? new Prisma.Decimal(dto.maxArea) : undefined,
        propertyIntent: dto.propertyIntent ?? undefined,
        financingNotes: dto.financingNotes ?? undefined,
        mustHaveTags: dto.mustHaveTags ?? [],
        niceToHaveTags: dto.niceToHaveTags ?? [],
        urgencyLevel: dto.urgencyLevel ?? undefined,
        extraJson: dto.extraJson ?? undefined,
      },
      update: {
        budgetMin: dto.budgetMin !== undefined ? (dto.budgetMin != null ? new Prisma.Decimal(dto.budgetMin) : null) : undefined,
        budgetMax: dto.budgetMax !== undefined ? (dto.budgetMax != null ? new Prisma.Decimal(dto.budgetMax) : null) : undefined,
        preferredDevelopmentIds: dto.preferredDevelopmentIds ?? undefined,
        preferredRegions: dto.preferredRegions ?? undefined,
        minArea: dto.minArea !== undefined ? (dto.minArea != null ? new Prisma.Decimal(dto.minArea) : null) : undefined,
        maxArea: dto.maxArea !== undefined ? (dto.maxArea != null ? new Prisma.Decimal(dto.maxArea) : null) : undefined,
        propertyIntent: dto.propertyIntent === undefined ? undefined : dto.propertyIntent ?? null,
        financingNotes: dto.financingNotes === undefined ? undefined : dto.financingNotes,
        mustHaveTags: dto.mustHaveTags ?? undefined,
        niceToHaveTags: dto.niceToHaveTags ?? undefined,
        urgencyLevel: dto.urgencyLevel === undefined ? undefined : dto.urgencyLevel,
        extraJson: dto.extraJson === undefined ? undefined : dto.extraJson,
      },
    });

    await this.matchSuggestions.refreshForLead(userId, role, leadId).catch(() => undefined);
    return profile;
  }
}
