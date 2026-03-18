import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeInput } from '../common/utils/xss.util';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  async findByDevelopment(developmentId: string) {
    return this.prisma.block.findMany({
      where: { developmentId },
      include: { _count: { select: { lots: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const block = await this.prisma.block.findUnique({
      where: { id },
      include: { lots: true, development: true },
    });
    if (!block) throw new NotFoundException('Quadra não encontrada');
    return block;
  }

  async create(developmentId: string, name: string) {
    return this.prisma.block.create({
      data: { developmentId, name: sanitizeInput(name) },
    });
  }

  async update(id: string, name: string) {
    return this.prisma.block.update({
      where: { id },
      data: { name: sanitizeInput(name) },
    });
  }

  async delete(id: string) {
    await this.prisma.block.delete({ where: { id } });
    return { message: 'Quadra removida' };
  }
}
