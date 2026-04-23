import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PortalCode,
  PortalListingLifecycleStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PortalConnectorFactory } from './portal-connector.factory';

@Injectable()
export class PortalHubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: PortalConnectorFactory,
    private readonly audit: AuditService,
  ) {}

  async listListings(userId: string, role: UserRole, filters?: { portal?: PortalCode; status?: PortalListingLifecycleStatus }) {
    const where: Prisma.PortalListingWhereInput = {};
    if (filters?.portal) where.portal = filters.portal;
    if (filters?.status) where.publicationStatus = filters.status;
    if (role === UserRole.CORRETOR) where.createdById = userId;

    return this.prisma.portalListing.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        lot: { include: { block: { include: { development: true } } } },
        property: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async createDraft(
    userId: string,
    dto: { lotId?: string; propertyId?: string; portal: PortalCode; title?: string; description?: string; price?: number },
  ) {
    if (!dto.lotId && !dto.propertyId) throw new BadRequestException('Informe lotId ou propertyId');
    return this.prisma.portalListing.create({
      data: {
        lotId: dto.lotId,
        propertyId: dto.propertyId,
        portal: dto.portal,
        title: dto.title,
        description: dto.description,
        price: dto.price != null ? new Prisma.Decimal(dto.price) : undefined,
        publicationStatus: PortalListingLifecycleStatus.DRAFT,
        createdById: userId,
      },
    });
  }

  async publish(userId: string, role: UserRole, id: string) {
    const row = await this.prisma.portalListing.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (role !== UserRole.ADMIN && row.createdById !== userId) throw new ForbiddenException();

    const connector = this.connectors.get(row.portal);
    const result = await connector.publish({
      listingId: row.id,
      portal: row.portal,
      title: row.title,
      description: row.description,
      price: row.price != null ? Number(row.price) : null,
      imagesSnapshot: row.imagesSnapshot,
      lotId: row.lotId,
      propertyId: row.propertyId,
    });

    const updated = await this.prisma.portalListing.update({
      where: { id },
      data: {
        externalListingId: result.externalListingId ?? undefined,
        publicationStatus: result.publicationStatus,
        lastError: result.message ?? null,
        lastSyncAt: new Date(),
        publishedAt:
          result.publicationStatus === PortalListingLifecycleStatus.PUBLISHED ? new Date() : undefined,
      },
    });

    await this.audit.log({
      userId,
      action: 'PORTAL_LISTING_PUBLISH',
      entity: 'PortalListing',
      entityId: id,
      metadata: { portal: row.portal, status: result.publicationStatus },
    });

    return updated;
  }

  async sync(userId: string, role: UserRole, id: string) {
    const row = await this.prisma.portalListing.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (role !== UserRole.ADMIN && row.createdById !== userId) throw new ForbiddenException();
    if (!row.externalListingId) throw new BadRequestException('Sem ID externo para sincronizar');

    const connector = this.connectors.get(row.portal);
    const result = await connector.sync({
      listingId: row.id,
      portal: row.portal,
      title: row.title,
      description: row.description,
      price: row.price != null ? Number(row.price) : null,
      imagesSnapshot: row.imagesSnapshot,
      lotId: row.lotId,
      propertyId: row.propertyId,
      externalListingId: row.externalListingId,
    });

    return this.prisma.portalListing.update({
      where: { id },
      data: {
        publicationStatus: result.publicationStatus,
        lastError: result.message ?? null,
        lastSyncAt: new Date(),
      },
    });
  }

  async markOutOfSync(lotId?: string, propertyId?: string) {
    const where: Prisma.PortalListingWhereInput = { publicationStatus: PortalListingLifecycleStatus.PUBLISHED };
    if (lotId) where.lotId = lotId;
    if (propertyId) where.propertyId = propertyId;
    await this.prisma.portalListing.updateMany({
      where,
      data: { publicationStatus: PortalListingLifecycleStatus.OUT_OF_SYNC },
    });
  }

  async connectorConfigs(userId: string, role: UserRole) {
    if (role !== UserRole.ADMIN) throw new ForbiddenException();
    return this.prisma.portalConnectorConfig.findMany({ orderBy: { portal: 'asc' } });
  }

  async upsertConnectorConfig(
    userId: string,
    role: UserRole,
    dto: { portal: PortalCode; label: string; credentialsEnvKey?: string; enabled?: boolean; metadataJson?: Prisma.InputJsonValue },
  ) {
    if (role !== UserRole.ADMIN) throw new ForbiddenException();
    return this.prisma.portalConnectorConfig.upsert({
      where: { portal_label: { portal: dto.portal, label: dto.label } },
      create: {
        portal: dto.portal,
        label: dto.label,
        credentialsEnvKey: dto.credentialsEnvKey,
        enabled: dto.enabled ?? false,
        metadataJson: dto.metadataJson as object | undefined,
        createdById: userId,
      },
      update: {
        credentialsEnvKey: dto.credentialsEnvKey,
        enabled: dto.enabled,
        metadataJson: dto.metadataJson as object | undefined,
      },
    });
  }
}
