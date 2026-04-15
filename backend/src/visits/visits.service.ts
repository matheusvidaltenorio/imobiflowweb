import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VisitStatus, UserRole, LeadStatus } from '@prisma/client';
import { LotScoringService } from '../lot-scoring/lot-scoring.service';
import { ClosingPredictionService } from '../closing-prediction/closing-prediction.service';

@Injectable()
export class VisitsService {
  constructor(
    private prisma: PrismaService,
    private scoring: LotScoringService,
    private closing: ClosingPredictionService,
  ) {}

  private async assertBrokerOnDevelopment(userId: string, role: UserRole, developmentId: string) {
    if (role === UserRole.ADMIN) return;
    const p = await this.prisma.property.findFirst({
      where: { userId, developmentId },
    });
    if (!p) throw new ForbiddenException('Sem permissão neste loteamento');
  }

  async create(
    userId: string,
    role: UserRole,
    data: {
      propertyId?: string;
      lotId?: string;
      clientId?: string;
      leadId?: string;
      scheduledAt: Date;
      notes?: string;
    },
  ) {
    const hasP = !!data.propertyId;
    const hasL = !!data.lotId;
    if ((!hasP && !hasL) || (hasP && hasL)) {
      throw new BadRequestException('Informe propertyId ou lotId (apenas um)');
    }

    if (data.propertyId) {
      const property = await this.prisma.property.findUnique({ where: { id: data.propertyId } });
      if (!property) throw new NotFoundException('Imóvel não encontrado');
      if (role !== UserRole.ADMIN && property.userId !== userId) {
        throw new ForbiddenException('Sem permissão');
      }
    }

    if (data.lotId) {
      const lot = await this.prisma.lot.findUnique({
        where: { id: data.lotId },
        include: { block: true },
      });
      if (!lot) throw new NotFoundException('Lote não encontrado');
      await this.assertBrokerOnDevelopment(userId, role, lot.block.developmentId);
    }

    if (data.leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: data.leadId },
        include: {
          property: true,
          lot: { include: { block: true } },
        },
      });
      if (!lead) throw new NotFoundException('Lead não encontrado');
      let ok = role === UserRole.ADMIN;
      if (!ok && lead.propertyId && lead.property?.userId === userId) ok = true;
      if (!ok && lead.lotId && lead.lot) {
        const p = await this.prisma.property.findFirst({
          where: { userId, developmentId: lead.lot.block.developmentId },
        });
        if (p) ok = true;
      }
      if (!ok && lead.developmentId) {
        const p = await this.prisma.property.findFirst({
          where: { userId, developmentId: lead.developmentId },
        });
        if (p) ok = true;
      }
      if (!ok) throw new ForbiddenException('Lead inválido');
    }

    const visit = await this.prisma.visit.create({
      data: {
        propertyId: data.propertyId ?? null,
        lotId: data.lotId ?? null,
        userId,
        clientId: data.clientId,
        leadId: data.leadId,
        scheduledAt: new Date(data.scheduledAt),
        notes: data.notes,
      },
      include: {
        property: { select: { id: true, title: true } },
        lot: {
          select: {
            id: true,
            number: true,
            block: { select: { name: true, development: { select: { name: true } } } },
          },
        },
        client: { select: { name: true, phone: true } },
        lead: { select: { name: true, email: true, phone: true } },
      },
    });

    if (data.lotId && visit.status === VisitStatus.AGENDADA) {
      await this.prisma.lot.update({
        where: { id: data.lotId },
        data: { scheduledVisitsCount: { increment: 1 } },
      });
    }

    if (data.leadId) {
      const prevLead = await this.prisma.lead.findUnique({ where: { id: data.leadId } });
      if (prevLead) {
        const terminal = prevLead.status === LeadStatus.VENDIDO || prevLead.status === LeadStatus.PERDIDO;
        const keepStage =
          prevLead.status === LeadStatus.RESERVADO ||
          prevLead.status === LeadStatus.PROPOSTA_ENVIADA ||
          prevLead.status === LeadStatus.VENDIDO;
        const nextStatus = terminal || keepStage ? prevLead.status : LeadStatus.VISITA_AGENDADA;
        await this.prisma.lead.update({
          where: { id: data.leadId },
          data: {
            status: nextStatus,
            leadLastInteractionAt: new Date(),
            interactionCount: { increment: 1 },
          },
        });
      }
      await this.prisma.leadInteraction.create({
        data: {
          leadId: data.leadId,
          userId,
          type: 'VISITA_AGENDADA',
          body: data.notes ?? null,
        },
      });
    }

    if (data.lotId) {
      await this.scoring.recalculateLotDevelopmentByLotId(data.lotId);
    }

    if (data.leadId) {
      await this.closing.recalculateLead(data.leadId);
    }

    return visit;
  }

  async findAllByUser(userId: string, role: UserRole) {
    const where = role === UserRole.ADMIN ? {} : { userId };

    return this.prisma.visit.findMany({
      where,
      include: {
        property: { select: { id: true, title: true, images: { take: 1 } } },
        lot: {
          select: {
            id: true,
            number: true,
            block: { select: { name: true, development: { select: { name: true } } } },
          },
        },
        client: { select: { name: true, phone: true } },
        lead: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findById(id: string, userId: string, role: UserRole) {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      include: {
        property: { select: { title: true } },
        lot: {
          select: {
            number: true,
            block: { select: { name: true, development: { select: { name: true } } } },
          },
        },
        client: { select: { name: true } },
      },
    });
    if (!visit) throw new NotFoundException('Visita não encontrada');
    if (role !== UserRole.ADMIN && visit.userId !== userId) throw new ForbiddenException('Sem permissão');
    return visit;
  }

  async update(id: string, userId: string, role: UserRole, data: { scheduledAt?: Date; status?: VisitStatus; notes?: string }) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Visita não encontrada');
    if (role !== UserRole.ADMIN && visit.userId !== userId) throw new ForbiddenException('Sem permissão');

    const nextStatus = data.status ?? visit.status;
    const lotId = visit.lotId;

    if (lotId) {
      const wasAgendada = visit.status === VisitStatus.AGENDADA;
      const nowAgendada = nextStatus === VisitStatus.AGENDADA;
      if (wasAgendada && !nowAgendada) {
        await this.prisma.lot.update({
          where: { id: lotId },
          data: { scheduledVisitsCount: { decrement: 1 } },
        });
      } else if (!wasAgendada && nowAgendada) {
        await this.prisma.lot.update({
          where: { id: lotId },
          data: { scheduledVisitsCount: { increment: 1 } },
        });
      }
    }

    const updated = await this.prisma.visit.update({
      where: { id },
      data: {
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        property: { select: { title: true } },
        lot: {
          select: {
            number: true,
            block: { select: { name: true, development: { select: { name: true } } } },
          },
        },
        client: { select: { name: true } },
      },
    });

    if (lotId) {
      await this.scoring.recalculateLotDevelopmentByLotId(lotId);
    }

    if (visit.leadId) {
      await this.closing.recalculateLead(visit.leadId);
    }

    return updated;
  }

  async delete(id: string, userId: string, role: UserRole) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Visita não encontrada');
    if (role !== UserRole.ADMIN && visit.userId !== userId) throw new ForbiddenException('Sem permissão');

    const lotId = visit.lotId;
    const leadId = visit.leadId;
    if (lotId && visit.status === VisitStatus.AGENDADA) {
      await this.prisma.lot.update({
        where: { id: lotId },
        data: { scheduledVisitsCount: { decrement: 1 } },
      });
    }

    await this.prisma.visit.delete({ where: { id } });

    if (lotId) {
      await this.scoring.recalculateLotDevelopmentByLotId(lotId);
    }

    if (leadId) {
      await this.closing.recalculateLead(leadId);
    }

    return { message: 'Visita removida' };
  }
}
