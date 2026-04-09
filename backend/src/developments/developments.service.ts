import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeInput } from '../common/utils/xss.util';
import { slugifyDevelopmentName } from '../common/utils/slug.util';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { normalizePolygonCoordinates, parseLatLngPair } from '../maps/geo.util';

@Injectable()
export class DevelopmentsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  private async ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let n = 0;
    for (;;) {
      const clash = await this.prisma.development.findFirst({
        where: {
          slug,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!clash) return slug;
      n += 1;
      slug = `${base}-${n}`;
    }
  }

  async findAll(adminOnly = false) {
    const developments = await this.prisma.development.findMany({
      include: {
        _count: { select: { properties: true, blocks: true } },
      },
      orderBy: { name: 'asc' },
    });
    const blockRows = await this.prisma.block.findMany({
      select: { developmentId: true, _count: { select: { lots: true } } },
    });
    const lotsByDev = blockRows.reduce<Record<string, number>>((acc, b) => {
      acc[b.developmentId] = (acc[b.developmentId] ?? 0) + b._count.lots;
      return acc;
    }, {});
    return developments.map((d) => ({
      ...d,
      lotsCount: lotsByDev[d.id] ?? 0,
    }));
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

  async create(data: {
    name: string;
    slug?: string;
    description?: string;
    address?: string;
    referenceAddress?: string;
    city: string;
    state?: string;
    neighborhood?: string;
    zipCode?: string;
    locationPrecision?: 'EXATA' | 'APROXIMADA' | 'PENDENTE';
    locationNotes?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
    polygonCoordinates?: unknown;
    coverImage?: string | null;
    coverImageAlt?: string | null;
  }) {
    const ll = parseLatLngPair(data.latitude, data.longitude);
    const poly = normalizePolygonCoordinates(data.polygonCoordinates);
    const baseSlug = data.slug?.trim()
      ? slugifyDevelopmentName(data.slug.trim())
      : slugifyDevelopmentName(data.name);
    const slug = await this.ensureUniqueSlug(baseSlug);
    return this.prisma.development.create({
      data: {
        name: sanitizeInput(data.name),
        slug,
        description: data.description ? sanitizeInput(data.description) : null,
        address: data.address,
        referenceAddress: data.referenceAddress?.trim() || null,
        city: data.city,
        state: data.state ? sanitizeInput(data.state) : null,
        neighborhood: data.neighborhood,
        ...(data.locationPrecision
          ? { locationPrecision: data.locationPrecision }
          : {}),
        locationNotes: data.locationNotes?.trim() || null,
        zipCode: data.zipCode?.trim() || null,
        latitude: ll ? new Prisma.Decimal(ll.lat) : null,
        longitude: ll ? new Prisma.Decimal(ll.lng) : null,
        placeId: data.placeId?.trim() || null,
        coverImage: data.coverImage?.trim() || null,
        coverImageAlt: data.coverImageAlt?.trim() || null,
        ...(poly === 'omit'
          ? {}
          : poly === 'null'
            ? { polygonCoordinates: Prisma.JsonNull }
            : { polygonCoordinates: poly }),
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      address?: string;
      referenceAddress?: string | null;
      city?: string;
      state?: string;
      neighborhood?: string;
      zipCode?: string | null;
      locationPrecision?: 'EXATA' | 'APROXIMADA' | 'PENDENTE';
      locationNotes?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      placeId?: string | null;
      polygonCoordinates?: unknown | null;
      coverImage?: string | null;
      coverImageAlt?: string | null;
      coverPublicId?: string | null;
      slug?: string | null;
    },
  ) {
    const patch: Prisma.DevelopmentUpdateInput = {
      ...(data.name && { name: sanitizeInput(data.name) }),
      ...(data.description !== undefined && {
        description: data.description ? sanitizeInput(data.description) : null,
      }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.referenceAddress !== undefined && {
        referenceAddress: data.referenceAddress?.trim() || null,
      }),
      ...(data.city && { city: data.city }),
      ...(data.state !== undefined && {
        state: data.state ? sanitizeInput(data.state) : null,
      }),
      ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
      ...(data.zipCode !== undefined && { zipCode: data.zipCode?.trim() || null }),
      ...(data.locationPrecision !== undefined && { locationPrecision: data.locationPrecision }),
      ...(data.locationNotes !== undefined && {
        locationNotes: data.locationNotes?.trim() || null,
      }),
      ...(data.placeId !== undefined && { placeId: data.placeId?.trim() || null }),
      ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
      ...(data.coverImageAlt !== undefined && { coverImageAlt: data.coverImageAlt }),
      ...(data.coverPublicId !== undefined && { coverPublicId: data.coverPublicId }),
    };

    if (data.slug !== undefined) {
      if (data.slug === null || data.slug.trim() === '') {
        patch.slug = null;
      } else {
        const next = await this.ensureUniqueSlug(
          slugifyDevelopmentName(data.slug.trim()),
          id,
        );
        patch.slug = next;
      }
    }

    if (data.latitude !== undefined || data.longitude !== undefined) {
      if (data.latitude === null && data.longitude === null) {
        patch.latitude = null;
        patch.longitude = null;
      } else {
        const ll = parseLatLngPair(data.latitude, data.longitude);
        if (!ll) throw new BadRequestException('Coordenadas incompletas.');
        patch.latitude = new Prisma.Decimal(ll.lat);
        patch.longitude = new Prisma.Decimal(ll.lng);
      }
    }

    if (data.polygonCoordinates !== undefined) {
      const poly = normalizePolygonCoordinates(data.polygonCoordinates);
      if (poly === 'null') patch.polygonCoordinates = Prisma.JsonNull;
      else if (poly !== 'omit') patch.polygonCoordinates = poly;
    }

    return this.prisma.development.update({
      where: { id },
      data: patch,
    });
  }

  async setCover(id: string, url: string, publicId: string) {
    const prev = await this.prisma.development.findUnique({
      where: { id },
      select: { coverPublicId: true },
    });
    if (!prev) throw new NotFoundException('Loteamento não encontrado');
    if (prev.coverPublicId) {
      try {
        await this.cloudinary.deleteImage(prev.coverPublicId);
      } catch {
        /* ignore */
      }
    }
    return this.prisma.development.update({
      where: { id },
      data: { coverImage: url, coverPublicId: publicId },
    });
  }

  async delete(id: string) {
    const dev = await this.prisma.development.findUnique({
      where: { id },
      select: { coverPublicId: true },
    });
    if (dev?.coverPublicId) {
      try {
        await this.cloudinary.deleteImage(dev.coverPublicId);
      } catch {
        /* ignore */
      }
    }
    await this.prisma.development.delete({ where: { id } });
    return { message: 'Loteamento removido' };
  }
}
