import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async add(userId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    const favorite = await this.prisma.favorite.upsert({
      where: {
        userId_propertyId: { userId, propertyId },
      },
      create: { userId, propertyId },
      update: {},
      include: {
        property: {
          include: { images: { orderBy: { order: 'asc' }, take: 1 } },
        },
      },
    });

    return favorite;
  }

  async remove(userId: string, propertyId: string) {
    await this.prisma.favorite.deleteMany({
      where: { userId, propertyId },
    });
    return { message: 'Removido dos favoritos' };
  }

  async findAll(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        property: {
          include: {
            images: { orderBy: { order: 'asc' } },
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isFavorite(userId: string, propertyId: string): Promise<boolean> {
    const fav = await this.prisma.favorite.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    });
    return !!fav;
  }
}
