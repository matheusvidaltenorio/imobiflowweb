import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeInput } from '../common/utils/xss.util';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAllByBroker(brokerId: string, isAdmin = false) {
    return this.prisma.client.findMany({
      where: isAdmin ? {} : { brokerId },
      include: {
        _count: { select: { visits: true, leads: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, brokerId: string, isAdmin = false) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { visits: true, leads: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (!isAdmin && client.brokerId !== brokerId) throw new ForbiddenException('Sem permissão');
    return client;
  }

  async create(brokerId: string, data: { name: string; email: string; phone?: string; notes?: string }) {
    return this.prisma.client.create({
      data: {
        brokerId,
        name: sanitizeInput(data.name),
        email: sanitizeInput(data.email),
        phone: data.phone,
        notes: data.notes ? sanitizeInput(data.notes) : null,
      },
    });
  }

  async update(
    id: string,
    brokerId: string,
    data: { name?: string; email?: string; phone?: string; notes?: string },
  ) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (client.brokerId !== brokerId) throw new ForbiddenException('Sem permissão');

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(data.name && { name: sanitizeInput(data.name) }),
        ...(data.email && { email: sanitizeInput(data.email) }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.notes !== undefined && { notes: data.notes ? sanitizeInput(data.notes) : null }),
      },
    });
  }

  async delete(id: string, brokerId: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (client.brokerId !== brokerId) throw new ForbiddenException('Sem permissão');

    await this.prisma.client.delete({ where: { id } });
    return { message: 'Cliente removido' };
  }
}
