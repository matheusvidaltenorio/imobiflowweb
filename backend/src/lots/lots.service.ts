import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, PropertyStatus } from '@prisma/client';
import { LotScoringService } from '../lot-scoring/lot-scoring.service';
import { ClosingPredictionService } from '../closing-prediction/closing-prediction.service';
import { inferLotGeoStatus, normalizePolygonCoordinates, parseLatLngPair } from '../maps/geo.util';
import {
  calculateLotSaleScore,
  commercialTags,
  type LotScoreInput,
} from '../lot-scoring/lot-score.engine';

const NEW_LOT_MS = 7 * 24 * 60 * 60 * 1000;
const OPPORTUNITY_RATIO = 0.85;

@Injectable()
export class LotsService {
  constructor(
    private prisma: PrismaService,
    private scoring: LotScoringService,
    private closing: ClosingPredictionService,
  ) {}

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

  private toScoreInput(lot: {
    price: Prisma.Decimal | null;
    area: Prisma.Decimal | null;
    viewCount: number;
    contactCount: number;
    scheduledVisitsCount: number;
    proposalsCount: number;
    manualHighlight: boolean;
    availableSince: Date | null;
    createdAt: Date;
  }): LotScoreInput {
    return {
      price: lot.price != null ? Number(lot.price) : null,
      area: lot.area != null ? Number(lot.area) : null,
      viewCount: lot.viewCount,
      contactCount: lot.contactCount,
      scheduledVisitsCount: lot.scheduledVisitsCount,
      proposalsCount: lot.proposalsCount,
      manualHighlight: lot.manualHighlight,
      availableSince: lot.availableSince,
      createdAt: lot.createdAt,
    };
  }

  async create(
    blockId: string,
    data: {
      number: string;
      area?: number;
      price?: number;
      status?: PropertyStatus;
      latitude?: number;
      longitude?: number;
      polygonCoordinates?: unknown;
      mapLabel?: string;
      referencePoint?: string;
      streetFront?: string;
    },
  ) {
    const status = data.status || PropertyStatus.DISPONIVEL;
    const ll = parseLatLngPair(data.latitude, data.longitude);
    const poly = normalizePolygonCoordinates(data.polygonCoordinates);
    const polygonValue =
      poly === 'omit' ? undefined : poly === 'null' ? Prisma.JsonNull : poly;
    const geoStatus = inferLotGeoStatus(
      polygonValue === Prisma.JsonNull ? null : polygonValue,
      ll?.lat ?? null,
      ll?.lng ?? null,
    );

    const created = await this.prisma.lot.create({
      data: {
        blockId,
        number: data.number,
        area: data.area ? new Decimal(data.area) : null,
        price: data.price ? new Decimal(data.price) : null,
        status,
        availableSince: status === PropertyStatus.DISPONIVEL ? new Date() : null,
        latitude: ll ? new Decimal(ll.lat) : null,
        longitude: ll ? new Decimal(ll.lng) : null,
        ...(polygonValue !== undefined ? { polygonCoordinates: polygonValue } : {}),
        mapLabel: data.mapLabel?.trim() || null,
        referencePoint: data.referencePoint?.trim() || null,
        streetFront: data.streetFront?.trim() || null,
        geoStatus,
      },
      include: { block: true },
    });
    await this.scoring.recalculateForDevelopment(created.block.developmentId);
    await this.closing.recalculateForLotLeads(created.id);
    return created;
  }

  async update(
    id: string,
    data: {
      number?: string;
      area?: number;
      price?: number;
      status?: PropertyStatus;
      manualHighlight?: boolean;
      latitude?: number | null;
      longitude?: number | null;
      polygonCoordinates?: unknown | null;
      mapLabel?: string | null;
      referencePoint?: string | null;
      streetFront?: string | null;
    },
  ) {
    const prev = await this.prisma.lot.findUnique({ where: { id }, include: { block: true } });
    if (!prev) throw new NotFoundException('Lote não encontrado');

    const nextStatus = data.status ?? prev.status;
    let availableSince = prev.availableSince;
    if (nextStatus === PropertyStatus.DISPONIVEL && prev.status !== PropertyStatus.DISPONIVEL) {
      availableSince = new Date();
    }
    if (nextStatus !== PropertyStatus.DISPONIVEL) {
      availableSince = null;
    }

    const patch: Prisma.LotUpdateInput = {
      ...(data.number && { number: data.number }),
      ...(data.area !== undefined && { area: data.area ? new Decimal(data.area) : null }),
      ...(data.price !== undefined && { price: data.price ? new Decimal(data.price) : null }),
      ...(data.status && { status: data.status }),
      ...(data.manualHighlight !== undefined && { manualHighlight: data.manualHighlight }),
      availableSince,
      ...(data.mapLabel !== undefined && { mapLabel: data.mapLabel?.trim() || null }),
      ...(data.referencePoint !== undefined && { referencePoint: data.referencePoint?.trim() || null }),
      ...(data.streetFront !== undefined && { streetFront: data.streetFront?.trim() || null }),
    };

    let nextLat = prev.latitude != null ? Number(prev.latitude) : null;
    let nextLng = prev.longitude != null ? Number(prev.longitude) : null;
    let nextPoly: unknown = prev.polygonCoordinates;

    if (data.latitude !== undefined || data.longitude !== undefined) {
      if (data.latitude === null && data.longitude === null) {
        nextLat = null;
        nextLng = null;
        patch.latitude = null;
        patch.longitude = null;
      } else {
        const ll = parseLatLngPair(data.latitude, data.longitude);
        if (!ll) throw new BadRequestException('Coordenadas incompletas.');
        nextLat = ll.lat;
        nextLng = ll.lng;
        patch.latitude = new Decimal(ll.lat);
        patch.longitude = new Decimal(ll.lng);
      }
    }

    if (data.polygonCoordinates !== undefined) {
      const poly = normalizePolygonCoordinates(data.polygonCoordinates);
      if (poly === 'null') {
        nextPoly = null;
        patch.polygonCoordinates = Prisma.JsonNull;
      } else if (poly !== 'omit') {
        nextPoly = poly;
        patch.polygonCoordinates = poly;
      }
    }

    patch.geoStatus = inferLotGeoStatus(nextPoly, nextLat, nextLng);

    const updated = await this.prisma.lot.update({
      where: { id },
      data: patch,
    });

    await this.scoring.recalculateForDevelopment(prev.block.developmentId);
    await this.closing.recalculateForLotLeads(id);
    return updated;
  }

  async delete(id: string) {
    const prev = await this.prisma.lot.findUnique({ where: { id }, include: { block: true } });
    if (!prev) throw new NotFoundException('Lote não encontrado');
    const devId = prev.block.developmentId;
    const linkedLeads = await this.prisma.lead.findMany({
      where: { lotId: id },
      select: { id: true },
    });
    await this.prisma.lot.delete({ where: { id } });
    await this.scoring.recalculateForDevelopment(devId);
    for (const l of linkedLeads) {
      await this.closing.recalculateLead(l.id);
    }
    return { message: 'Lote removido' };
  }

  async incrementView(id: string) {
    let row: { block: { developmentId: string } };
    try {
      row = await this.prisma.lot.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
        select: { block: { select: { developmentId: true } } },
      });
    } catch {
      throw new NotFoundException('Lote não encontrado');
    }
    await this.scoring.recalculateForDevelopment(row.block.developmentId);
    return { ok: true };
  }

  async findMapByDevelopment(
    developmentId: string,
    opts?: { nearbyRadiusMeters?: number; nearbyTravelMode?: string },
  ) {
    const nearbyRadius = opts?.nearbyRadiusMeters ?? 3000;
    const nearbyMode = opts?.nearbyTravelMode === 'walking' ? 'walking' : 'driving';

    const dev = await this.prisma.development.findUnique({
      where: { id: developmentId },
      include: {
        blocks: {
          orderBy: { name: 'asc' },
          include: {
            lots: { orderBy: { number: 'asc' } },
          },
        },
        nearbyPlaces: {
          where: {
            searchRadiusMeters: nearbyRadius,
            travelMode: nearbyMode,
          },
          orderBy: [{ category: 'asc' }, { travelTimeMinutes: 'asc' }],
        },
      },
    });
    if (!dev) throw new NotFoundException('Loteamento não encontrado');

    const availablePrices = dev.blocks.flatMap((b) =>
      b.lots.filter((l) => l.status === PropertyStatus.DISPONIVEL && l.price != null).map((l) => Number(l.price)),
    );
    const sorted = [...availablePrices].sort((a, b) => a - b);
    const medianPrice =
      sorted.length === 0
        ? null
        : sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

    const maxViews = Math.max(0, ...dev.blocks.flatMap((b) => b.lots.map((l) => l.viewCount)));

    const allLotsFlat = dev.blocks.flatMap((b) => b.lots);
    const cohortInputs = allLotsFlat.map((l) => this.toScoreInput(l));

    const lots = dev.blocks.flatMap((block) =>
      block.lots.map((lot) => {
        const priceNum = lot.price != null ? Number(lot.price) : null;
        const isOpportunity =
          lot.status === PropertyStatus.DISPONIVEL &&
          priceNum != null &&
          medianPrice != null &&
          priceNum < medianPrice * OPPORTUNITY_RATIO;
        const isNew = Date.now() - new Date(lot.createdAt).getTime() < NEW_LOT_MS;
        const popular = maxViews > 0 && lot.viewCount >= maxViews * 0.7 && lot.viewCount > 2;
        let priorityScore = 0;
        if (isOpportunity) priorityScore += 3;
        if (popular) priorityScore += 2;
        if (isNew) priorityScore += 1;
        if (priceNum != null && medianPrice != null && priceNum <= medianPrice) priorityScore += 1;
        const saleScore = lot.saleScore != null ? Number(lot.saleScore) : null;

        const selfInput = this.toScoreInput(lot);
        const { score: cohortScore } = calculateLotSaleScore(selfInput, cohortInputs);
        const tags = commercialTags(cohortScore, selfInput, cohortInputs);
        const isChampion = tags.includes('CAMPEAO_VENDA');
        const isStalled =
          tags.includes('NECESITA_ATENCAO_COMERCIAL') || tags.includes('BAIXA_CONVERSAO');

        return {
          id: lot.id,
          number: lot.number,
          status: lot.status,
          area: lot.area != null ? Number(lot.area) : null,
          price: priceNum,
          viewCount: lot.viewCount,
          contactCount: lot.contactCount,
          createdAt: lot.createdAt,
          blockId: block.id,
          blockName: block.name,
          isOpportunity,
          isNew,
          popular,
          priorityScore,
          saleScore,
          saleClassification: lot.saleClassification,
          saleScoreReason: lot.saleScoreReason,
          manualHighlight: lot.manualHighlight,
          latitude: lot.latitude != null ? Number(lot.latitude) : null,
          longitude: lot.longitude != null ? Number(lot.longitude) : null,
          polygonCoordinates: lot.polygonCoordinates,
          mapLabel: lot.mapLabel,
          referencePoint: lot.referencePoint,
          streetFront: lot.streetFront,
          geoStatus: lot.geoStatus,
          commercialTags: tags,
          isChampion,
          isStalled,
        };
      }),
    );

    lots.sort((a, b) => b.priorityScore - a.priorityScore || (a.price ?? 0) - (b.price ?? 0));

    const nearbyRows = dev.nearbyPlaces;

    return {
      development: {
        id: dev.id,
        name: dev.name,
        description: dev.description,
        city: dev.city,
        state: dev.state,
        address: dev.address,
        street: dev.street,
        streetNumber: dev.streetNumber,
        referenceAddress: dev.referenceAddress,
        neighborhood: dev.neighborhood,
        zipCode: dev.zipCode,
        locationPrecision: dev.locationPrecision,
        locationNotes: dev.locationNotes,
        placeName: dev.placeName,
        geocodingStatus: dev.geocodingStatus,
        latitude: dev.latitude != null ? Number(dev.latitude) : null,
        longitude: dev.longitude != null ? Number(dev.longitude) : null,
        placeId: dev.placeId,
        polygonCoordinates: dev.polygonCoordinates,
        polygonSource: dev.polygonSource,
        coverImage: dev.coverImage,
      },
      nearbyPlaces: nearbyRows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        subcategory: r.subcategory,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        shortAddress: r.shortAddress,
        distanceMeters: r.distanceMeters,
        travelTimeMinutes: r.travelTimeMinutes,
        travelMode: r.travelMode,
        routeSource: r.routeSource,
        source: r.source,
      })),
      nearbyQuery: { radiusMeters: nearbyRadius, travelMode: nearbyMode },
      medianPrice,
      lots,
    };
  }
}
