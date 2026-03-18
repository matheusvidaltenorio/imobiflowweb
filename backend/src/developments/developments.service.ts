import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { sanitizeInput } from '../common/utils/xss.util';

@Injectable()
export class DevelopmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(adminOnly = false) {
    return this.prisma.development.findMany({
      include: {
        _count: { select: { properties: true, blocks: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const dev = await this.prisma.development.findUnique({
      where: { id },
      include: {
        blocks: { include: { _count: { select: { lots: true } } } },
        properties: { take: 5 },
      },
    });
    if (!dev) throw new NotFoundException('Loteamento não encontrado');
    return dev;
  }

  async create(data: { name: string; description?: string; address?: string; city: string; neighborhood?: string }) {
    return this.prisma.development.create({
      data: {
        name: sanitizeInput(data.name),
        description: data.description ? sanitizeInput(data.description) : null,
        address: data.address,
        city: data.city,
        neighborhood: data.neighborhood,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; description?: string; address?: string; city?: string; neighborhood?: string },
  ) {
    return this.prisma.development.update({
      where: { id },
      data: {
        ...(data.name && { name: sanitizeInput(data.name) }),
        ...(data.description !== undefined && {
          description: data.description ? sanitizeInput(data.description) : null,
        }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city && { city: data.city }),
        ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
      },
    });
  }

  async delete(id: string) {
    await this.prisma.development.delete({ where: { id } });
    return { message: 'Loteamento removido' };
  }
}
