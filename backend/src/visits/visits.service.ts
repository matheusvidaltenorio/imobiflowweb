import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VisitStatus, UserRole } from '@prisma/client';

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: { propertyId: string; clientId?: string; leadId?: string; scheduledAt: Date; notes?: string }) {
    const property = await this.prisma.property.findUnique({ where: { id: data.propertyId } });
    if (!property) throw new NotFoundException('Imóvel não encontrado');
    if (property.userId !== userId) throw new ForbiddenException('Sem permissão');

    if (data.leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: data.leadId }, include: { property: true } });
      if (!lead || lead.property.userId !== userId) throw new ForbiddenException('Lead inválido');
    }

    const visit = await this.prisma.visit.create({
      data: {
        propertyId: data.propertyId,
        userId,
        clientId: data.clientId,
        leadId: data.leadId,
        scheduledAt: new Date(data.scheduledAt),
        notes: data.notes,
      },
      include: {
        property: { select: { id: true, title: true } },
        client: { select: { name: true, phone: true } },
        lead: { select: { name: true, email: true, phone: true } },
      },
    });

    if (data.leadId) {
      await this.prisma.lead.update({
        where: { id: data.leadId },
        data: { status: 'NEGOCIACAO' },
      });
    }

    return visit;
  }

  async findAllByUser(userId: string, role: UserRole) {
    const where = role === UserRole.ADMIN ? {} : { userId };

    return this.prisma.visit.findMany({
      where,
      include: {
        property: { select: { id: true, title: true, images: { take: 1 } } },
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

    return this.prisma.visit.update({
      where: { id },
      data: {
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        property: { select: { title: true } },
        client: { select: { name: true } },
      },
    });
  }

  async delete(id: string, userId: string, role: UserRole) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException('Visita não encontrada');
    if (role !== UserRole.ADMIN && visit.userId !== userId) throw new ForbiddenException('Sem permissão');

    await this.prisma.visit.delete({ where: { id } });
    return { message: 'Visita removida' };
  }
}
