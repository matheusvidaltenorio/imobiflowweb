import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, LeadStatus } from '@prisma/client';
import { sanitizeInput } from '../common/utils/xss.util';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(
    data: {
      propertyId: string;
      name: string;
      email: string;
      phone?: string;
      message?: string;
      source?: string;
      userId?: string;
      clientId?: string;
    },
    ip?: string,
  ) {
    const property = await this.prisma.property.findUnique({ where: { id: data.propertyId } });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    const lead = await this.prisma.lead.create({
      data: {
        propertyId: data.propertyId,
        userId: data.userId,
        clientId: data.clientId,
        name: sanitizeInput(data.name),
        email: sanitizeInput(data.email),
        phone: data.phone,
        message: data.message ? sanitizeInput(data.message) : null,
        source: data.source,
      },
      include: {
        property: { select: { title: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: property.userId,
        action: 'LEAD',
        entity: 'Lead',
        entityId: lead.id,
        metadata: { propertyId: data.propertyId } as object,
        ipAddress: ip,
      },
    });

    return lead;
  }

  async findAllByUser(userId: string, role: UserRole) {
    const properties = await this.prisma.property.findMany({
      where: role === UserRole.ADMIN ? {} : { userId },
      select: { id: true },
    });
    const ids = properties.map((p) => p.id);

    return this.prisma.lead.findMany({
      where: { propertyId: { in: ids } },
      include: {
        property: { select: { id: true, title: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(leadId: string, userId: string, role: UserRole) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        property: { select: { id: true, title: true, userId: true } },
      },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (role !== UserRole.ADMIN && lead.property.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }
    return lead;
  }

  async updateStatus(leadId: string, userId: string, role: UserRole, status: LeadStatus) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { property: true },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (role !== UserRole.ADMIN && lead.property.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    return this.prisma.lead.update({
      where: { id: leadId },
      data: { status },
      include: {
        property: { select: { id: true, title: true } },
      },
    });
  }
}
