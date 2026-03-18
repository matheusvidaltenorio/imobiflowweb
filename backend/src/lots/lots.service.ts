import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { PropertyStatus } from '@prisma/client';

@Injectable()
export class LotsService {
  constructor(private prisma: PrismaService) {}

  async findByBlock(blockId: string) {
    return this.prisma.lot.findMany({
      where: { blockId },
      orderBy: { number: 'asc' },
    });
  }

  async findById(id: string) {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: { block: { include: { development: true } } },
    });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    return lot;
  }

  async create(
    blockId: string,
    data: { number: string; area?: number; price?: number; status?: PropertyStatus },
  ) {
    return this.prisma.lot.create({
      data: {
        blockId,
        number: data.number,
        area: data.area ? new Decimal(data.area) : null,
        price: data.price ? new Decimal(data.price) : null,
        status: data.status || PropertyStatus.DISPONIVEL,
      },
    });
  }

  async update(
    id: string,
    data: { number?: string; area?: number; price?: number; status?: PropertyStatus },
  ) {
    return this.prisma.lot.update({
      where: { id },
      data: {
        ...(data.number && { number: data.number }),
        ...(data.area !== undefined && { area: data.area ? new Decimal(data.area) : null }),
        ...(data.price !== undefined && { price: data.price ? new Decimal(data.price) : null }),
        ...(data.status && { status: data.status }),
      },
    });
  }

  async delete(id: string) {
    await this.prisma.lot.delete({ where: { id } });
    return { message: 'Lote removido' };
  }
}
