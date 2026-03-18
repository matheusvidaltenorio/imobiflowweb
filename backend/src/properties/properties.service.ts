import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PropertyType, PropertyStatus, UserRole } from '@prisma/client';
import { sanitizeInput } from '../common/utils/xss.util';

interface CreatePropertyDto {
  title: string;
  description?: string;
  type: PropertyType;
  status?: PropertyStatus;
  price: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  garageSpaces?: number;
  city: string;
  neighborhood: string;
  street?: string;
  number?: string;
  complement?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  developmentId?: string;
}

@Injectable()
export class PropertiesService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async create(userId: string, dto: CreatePropertyDto, ip?: string) {
    const data = {
      ...dto,
      title: sanitizeInput(dto.title),
      description: dto.description ? sanitizeInput(dto.description) : null,
      price: new Decimal(dto.price),
      area: dto.area ? new Decimal(dto.area) : null,
      bedrooms: dto.bedrooms,
      bathrooms: dto.bathrooms,
      garageSpaces: dto.garageSpaces,
      userId,
    };

    const property = await this.prisma.property.create({ data });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'Property',
        entityId: property.id,
        ipAddress: ip,
      },
    });

    return this.findById(property.id);
  }

  async findAllPublic(filters: {
    city?: string;
    neighborhood?: string;
    minPrice?: number;
    maxPrice?: number;
    type?: PropertyType;
    status?: PropertyStatus;
    search?: string;
  }) {
    const where: Record<string, unknown> = {
      status: filters.status || 'DISPONIVEL',
    };

    if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters.neighborhood) where.neighborhood = { contains: filters.neighborhood, mode: 'insensitive' };
    if (filters.type) where.type = filters.type;
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) (where.price as Record<string, number>).gte = filters.minPrice;
      if (filters.maxPrice) (where.price as Record<string, number>).lte = filters.maxPrice;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { neighborhood: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: {
          images: { orderBy: { order: 'asc' }, take: 1 },
          user: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.property.count({ where }),
    ]);

    return { items, total };
  }

  async findAllByUser(userId: string, role: UserRole) {
    const where: { userId?: string } = role === UserRole.ADMIN ? {} : { userId };

    return this.prisma.property.findMany({
      where,
      include: {
        images: { orderBy: { order: 'asc' } },
        user: { select: { name: true, email: true } },
        development: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: 'asc' } },
        user: { select: { id: true, name: true, phone: true, email: true } },
        development: { select: { name: true, id: true } },
      },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado');
    return property;
  }

  async update(id: string, userId: string, role: UserRole, dto: Partial<CreatePropertyDto>, ip?: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    if (role !== UserRole.ADMIN && property.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    const data: Record<string, unknown> = { ...dto };
    if (dto.title) data.title = sanitizeInput(dto.title);
    if (dto.description !== undefined) data.description = dto.description ? sanitizeInput(dto.description) : null;
    if (dto.price !== undefined) data.price = new Decimal(dto.price);
    if (dto.area !== undefined) data.area = dto.area ? new Decimal(dto.area) : null;

    await this.prisma.property.update({ where: { id }, data });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Property',
        entityId: id,
        ipAddress: ip,
      },
    });

    return this.findById(id);
  }

  async delete(id: string, userId: string, role: UserRole, ip?: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Imóvel não encontrado');

    if (role !== UserRole.ADMIN && property.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    await this.prisma.property.delete({ where: { id } });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETE',
        entity: 'Property',
        entityId: id,
        ipAddress: ip,
      },
    });

    return { message: 'Imóvel removido' };
  }

  async addImage(propertyId: string, url: string, publicId: string, userId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Imóvel não encontrado');
    if (property.userId !== userId) throw new ForbiddenException('Sem permissão');

    const count = await this.prisma.propertyImage.count({ where: { propertyId } });
    return this.prisma.propertyImage.create({
      data: { propertyId, url, publicId, order: count },
    });
  }

  async removeImage(propertyId: string, imageId: string, userId: string) {
    const img = await this.prisma.propertyImage.findFirst({
      where: { id: imageId, propertyId },
      include: { property: true },
    });
    if (!img) throw new NotFoundException('Imagem não encontrada');
    if (img.property.userId !== userId) throw new ForbiddenException('Sem permissão');

    await this.prisma.propertyImage.delete({ where: { id: imageId } });
    if (img.publicId) await this.cloudinary.deleteImage(img.publicId);
    return { message: 'Imagem removida' };
  }

  async generateDescription(propertyId: string, userId: string) {
    const property = await this.findById(propertyId);
    if (property.userId !== userId) throw new ForbiddenException('Sem permissão');

    const parts: string[] = [];
    parts.push(`Imóvel ${property.type.toLowerCase()} em ${property.neighborhood}, ${property.city}.`);
    if (property.bedrooms) parts.push(`${property.bedrooms} quarto(s).`);
    if (property.bathrooms) parts.push(`${property.bathrooms} banheiro(s).`);
    if (property.area) parts.push(`Área de ${property.area}m².`);
    if (property.garageSpaces) parts.push(`${property.garageSpaces} vaga(s) na garagem.`);
    const description = parts.join(' ');

    await this.prisma.property.update({
      where: { id: propertyId },
      data: { description },
    });

    return { description };
  }
}
