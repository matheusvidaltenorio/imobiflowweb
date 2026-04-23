import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type LotImageMapItemDto = {
  lotId: string;
  xNorm: number;
  yNorm: number;
  wNorm?: number;
  hNorm?: number;
  refImageWidth?: number;
  refImageHeight?: number;
};

@Injectable()
export class LotImageMapService {
  constructor(private readonly prisma: PrismaService) {}

  async listByDevelopment(developmentId: string) {
    return this.prisma.lotImageMap.findMany({
      where: { developmentId },
      include: { lot: { select: { id: true, number: true, block: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsertBatch(developmentId: string, userId: string, items: LotImageMapItemDto[]) {
    const dev = await this.prisma.development.findUnique({ where: { id: developmentId } });
    if (!dev) throw new NotFoundException('Loteamento não encontrado');

    for (const it of items) {
      if (it.xNorm < 0 || it.xNorm > 1 || it.yNorm < 0 || it.yNorm > 1) {
        throw new BadRequestException('Coordenadas normalizadas devem estar entre 0 e 1');
      }
      const lot = await this.prisma.lot.findFirst({
        where: { id: it.lotId, block: { developmentId } },
        select: { id: true },
      });
      if (!lot) throw new BadRequestException(`Lote ${it.lotId} não pertence ao loteamento`);

      await this.prisma.lotImageMap.upsert({
        where: { lotId: it.lotId },
        create: {
          developmentId,
          lotId: it.lotId,
          xNorm: new Prisma.Decimal(it.xNorm),
          yNorm: new Prisma.Decimal(it.yNorm),
          wNorm: it.wNorm != null ? new Prisma.Decimal(it.wNorm) : null,
          hNorm: it.hNorm != null ? new Prisma.Decimal(it.hNorm) : null,
          refImageWidth: it.refImageWidth ?? null,
          refImageHeight: it.refImageHeight ?? null,
          createdById: userId,
        },
        update: {
          xNorm: new Prisma.Decimal(it.xNorm),
          yNorm: new Prisma.Decimal(it.yNorm),
          wNorm: it.wNorm != null ? new Prisma.Decimal(it.wNorm) : null,
          hNorm: it.hNorm != null ? new Prisma.Decimal(it.hNorm) : null,
          refImageWidth: it.refImageWidth ?? null,
          refImageHeight: it.refImageHeight ?? null,
        },
      });
    }

    return this.listByDevelopment(developmentId);
  }

  async deleteByLot(developmentId: string, lotId: string) {
    const row = await this.prisma.lotImageMap.findFirst({
      where: { developmentId, lotId },
    });
    if (!row) throw new NotFoundException('Mapeamento não encontrado');
    await this.prisma.lotImageMap.delete({ where: { id: row.id } });
    return { ok: true };
  }
}
