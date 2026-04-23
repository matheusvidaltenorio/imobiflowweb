import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogShareStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogShareService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertBroker(userId: string, role: UserRole, brokerUserId: string) {
    if (role === UserRole.ADMIN) return;
    if (userId !== brokerUserId) throw new ForbiddenException();
  }

  async create(
    userId: string,
    role: UserRole,
    dto: { title: string; message?: string; leadId?: string; clientId?: string; brokerUserId?: string },
  ) {
    const brokerUserId = role === UserRole.ADMIN ? dto.brokerUserId ?? userId : userId;
    return this.prisma.catalogShare.create({
      data: {
        brokerUserId,
        title: dto.title,
        message: dto.message,
        leadId: dto.leadId,
        clientId: dto.clientId,
        status: CatalogShareStatus.DRAFT,
      },
    });
  }

  async setItems(
    userId: string,
    role: UserRole,
    catalogId: string,
    items: Array<{ lotId?: string; propertyId?: string; brokerNote?: string; sortOrder?: number }>,
  ) {
    const c = await this.prisma.catalogShare.findUnique({ where: { id: catalogId } });
    if (!c) throw new NotFoundException();
    await this.assertBroker(userId, role, c.brokerUserId);
    await this.prisma.catalogShareItem.deleteMany({ where: { catalogShareId: catalogId } });
    if (!items.length) return this.prisma.catalogShare.findUnique({ where: { id: catalogId }, include: { items: true } });
    await this.prisma.catalogShareItem.createMany({
      data: items.map((it, i) => ({
        catalogShareId: catalogId,
        lotId: it.lotId ?? null,
        propertyId: it.propertyId ?? null,
        brokerNote: it.brokerNote ?? null,
        sortOrder: it.sortOrder ?? i,
      })),
    });
    return this.prisma.catalogShare.findUnique({ where: { id: catalogId }, include: { items: true } });
  }

  async markSent(userId: string, role: UserRole, catalogId: string) {
    const c = await this.prisma.catalogShare.findUnique({ where: { id: catalogId } });
    if (!c) throw new NotFoundException();
    await this.assertBroker(userId, role, c.brokerUserId);
    return this.prisma.catalogShare.update({
      where: { id: catalogId },
      data: { status: CatalogShareStatus.SENT, sentAt: new Date() },
    });
  }

  async listMine(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.prisma.catalogShare.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { items: true } });
    }
    return this.prisma.catalogShare.findMany({
      where: { brokerUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: true },
    });
  }

  /** Link público (somente leitura). */
  async getPublicByToken(token: string) {
    const row = await this.prisma.catalogShare.findUnique({
      where: { shareToken: token },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        lead: { select: { name: true } },
        client: { select: { name: true } },
      },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
}
