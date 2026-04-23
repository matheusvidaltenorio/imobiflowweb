import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MatchSuggestionStatus,
  MatchTargetKind,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MatchEngineService } from './match-engine.service';

@Injectable()
export class MatchSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: MatchEngineService,
  ) {}

  private async assertLeadAccess(userId: string, role: UserRole, leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (role === UserRole.ADMIN) return lead;
    if (lead.userId === userId) return lead;
    throw new ForbiddenException();
  }

  async listForLead(userId: string, role: UserRole, leadId: string) {
    await this.assertLeadAccess(userId, role, leadId);
    return this.prisma.matchSuggestion.findMany({
      where: { leadId },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        lot: {
          include: { block: { include: { development: true } } },
        },
        property: true,
      },
    });
  }

  async refreshForLead(userId: string, role: UserRole, leadId: string) {
    const lead = await this.assertLeadAccess(userId, role, leadId);
    const scored = await this.engine.buildForLead(leadId);
    const runId = randomUUID();

    await this.prisma.matchSuggestion.deleteMany({
      where: { leadId, status: MatchSuggestionStatus.SUGGESTED },
    });

    if (scored.length) {
      await this.prisma.matchSuggestion.createMany({
        data: scored.map((s) => ({
          leadId,
          matchRunId: runId,
          kind: s.kind === 'LOT' ? MatchTargetKind.LOT : MatchTargetKind.PROPERTY,
          lotId: s.kind === 'LOT' ? s.lotId : null,
          propertyId: s.kind === 'PROPERTY' ? s.propertyId : null,
          score: new Prisma.Decimal(s.score),
          reasonsJson: (s.kind === 'LOT' ? s.reasons : s.reasons) as unknown as Prisma.InputJsonValue,
          status: MatchSuggestionStatus.SUGGESTED,
        })),
      });
    }

    if (lead.userId && scored[0] && scored[0].score >= 0.72) {
      await this.prisma.inAppNotification.create({
        data: {
          userId: lead.userId,
          type: 'MATCH_HIGH',
          title: 'Sugestões de match atualizadas',
          body: `Há oportunidades compatíveis com o lead ${lead.name}.`,
          metadataJson: { leadId, runId } as Prisma.InputJsonValue,
        },
      });
    }

    return this.listForLead(userId, role, leadId);
  }
}
