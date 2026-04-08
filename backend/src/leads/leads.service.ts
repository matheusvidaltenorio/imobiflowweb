import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, LeadStatus } from '@prisma/client';
import { sanitizeInput } from '../common/utils/xss.util';
import { LotScoringService } from '../lot-scoring/lot-scoring.service';
import { ClosingPredictionService } from '../closing-prediction/closing-prediction.service';

const HOT_INTERACTION_THRESHOLD = 3;
const ALLOWED_LEAD_SOURCES = [
  'WHATSAPP',
  'SITE',
  'INDICACAO',
  'INSTAGRAM',
  'FACEBOOK',
  'OUTRO',
] as const;

const leadInclude = {
  property: { select: { id: true, title: true, price: true, userId: true } },
  lot: {
    select: {
      id: true,
      number: true,
      price: true,
      area: true,
      status: true,
      viewCount: true,
      block: {
        select: {
          id: true,
          name: true,
          developmentId: true,
          development: { select: { id: true, name: true, city: true } },
        },
      },
    },
  },
  interactions: { orderBy: { createdAt: 'desc' as const }, take: 20 },
} as const;

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private scoring: LotScoringService,
    private closing: ClosingPredictionService,
  ) {}

  private async brokerDevelopmentIds(userId: string, role: UserRole): Promise<string[]> {
    if (role === UserRole.ADMIN) {
      const all = await this.prisma.development.findMany({ select: { id: true } });
      return all.map((d) => d.id);
    }
    const rows = await this.prisma.property.findMany({
      where: { userId, developmentId: { not: null } },
      select: { developmentId: true },
      distinct: ['developmentId'],
    });
    return rows.map((r) => r.developmentId).filter((id): id is string => !!id);
  }

  private async activityOwnerForLot(lotId: string): Promise<string> {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { block: true },
    });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    const prop = await this.prisma.property.findFirst({
      where: { developmentId: lot.block.developmentId },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (prop?.userId) return prop.userId;
    const admin = await this.prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });
    if (!admin) throw new BadRequestException('Não foi possível associar o lead a um corretor');
    return admin.id;
  }

  async create(
    data: {
      propertyId?: string;
      lotId?: string;
      name: string;
      email: string;
      phone?: string;
      message?: string;
      source?: string;
      leadSource?: string;
      userId?: string;
      clientId?: string;
    },
    ip?: string,
  ) {
    if ((!data.propertyId && !data.lotId) || (data.propertyId && data.lotId)) {
      throw new BadRequestException('Informe propertyId (imóvel) ou lotId (lote), não ambos');
    }

    let activityUserId: string;

    if (data.propertyId) {
      const property = await this.prisma.property.findUnique({ where: { id: data.propertyId } });
      if (!property) throw new NotFoundException('Imóvel não encontrado');
      activityUserId = property.userId;
    } else {
      activityUserId = await this.activityOwnerForLot(data.lotId!);
    }

    const src = data.leadSource?.toUpperCase();
    const leadSource =
      src && (ALLOWED_LEAD_SOURCES as readonly string[]).includes(src) ? src : undefined;

    const lead = await this.prisma.lead.create({
      data: {
        propertyId: data.propertyId ?? null,
        lotId: data.lotId ?? null,
        userId: data.userId,
        clientId: data.clientId,
        name: sanitizeInput(data.name),
        email: sanitizeInput(data.email),
        phone: data.phone,
        message: data.message ? sanitizeInput(data.message) : null,
        source: data.source,
        leadSource: leadSource ?? data.source,
        interactionCount: 1,
      },
      include: leadInclude,
    });

    await this.prisma.leadInteraction.create({
      data: {
        leadId: lead.id,
        type: 'CRIACAO',
        body: 'Lead registrado',
      },
    });

    if (data.lotId) {
      await this.prisma.lot.update({
        where: { id: data.lotId },
        data: { contactCount: { increment: 1 } },
      });
      await this.scoring.recalculateLotDevelopmentByLotId(data.lotId);
    }

    await this.prisma.activityLog.create({
      data: {
        userId: activityUserId,
        action: 'LEAD',
        entity: 'Lead',
        entityId: lead.id,
        metadata: { propertyId: data.propertyId, lotId: data.lotId } as object,
        ipAddress: ip,
      },
    });

    await this.closing.recalculateLead(lead.id);

    return this.prisma.lead.findUniqueOrThrow({
      where: { id: lead.id },
      include: leadInclude,
    });
  }

  async findAllByUser(
    userId: string,
    role: UserRole,
    sort?: 'closing' | 'risk' | 'recent',
  ) {
    const propertyRows = await this.prisma.property.findMany({
      where: role === UserRole.ADMIN ? {} : { userId },
      select: { id: true },
    });
    const propertyIds = propertyRows.map((p) => p.id);

    const devIds = await this.brokerDevelopmentIds(userId, role);

    const or: Array<Record<string, unknown>> = [];
    if (propertyIds.length) or.push({ propertyId: { in: propertyIds } });
    if (role === UserRole.ADMIN) {
      or.push({ lotId: { not: null } });
    } else if (devIds.length) {
      or.push({
        lot: { block: { developmentId: { in: devIds } } },
      });
    }

    if (!or.length) return [];

    const orderBy =
      sort === 'closing'
        ? [{ closingScore: 'desc' as const }, { createdAt: 'desc' as const }]
        : sort === 'risk'
          ? [{ closingScore: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'recent'
            ? [{ leadLastInteractionAt: 'desc' as const }, { createdAt: 'desc' as const }]
            : { createdAt: 'desc' as const };

    return this.prisma.lead.findMany({
      where: { OR: or },
      include: leadInclude,
      orderBy,
    });
  }

  async findById(leadId: string, userId: string, role: UserRole) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: leadInclude,
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (!(await this.canAccessLead(lead, userId, role))) {
      throw new ForbiddenException('Sem permissão');
    }
    return lead;
  }

  private async canAccessLead(
    lead: { property?: { userId: string } | null; lot?: { block: { developmentId: string } } | null },
    userId: string,
    role: UserRole,
  ): Promise<boolean> {
    if (role === UserRole.ADMIN) return true;
    if (lead.property && lead.property.userId === userId) return true;
    if (lead.lot) {
      const p = await this.prisma.property.findFirst({
        where: { userId, developmentId: lead.lot.block.developmentId },
      });
      return !!p;
    }
    return false;
  }

  async updateStatus(leadId: string, userId: string, role: UserRole, status: LeadStatus) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: leadInclude,
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (!(await this.canAccessLead(lead, userId, role))) {
      throw new ForbiddenException('Sem permissão');
    }

    const wasNegotiation =
      lead.status === LeadStatus.NEGOCIACAO || lead.status === LeadStatus.VENDIDO;
    const nowNegotiation = status === LeadStatus.NEGOCIACAO;

    await this.prisma.$transaction(async (tx) => {
      if (lead.lotId && !wasNegotiation && nowNegotiation) {
        await tx.lot.update({
          where: { id: lead.lotId },
          data: { proposalsCount: { increment: 1 } },
        });
      }
      await tx.lead.update({
        where: { id: leadId },
        data: { status },
      });
    });

    if (lead.lotId) {
      await this.scoring.recalculateLotDevelopmentByLotId(lead.lotId);
    }

    await this.closing.recalculateLead(leadId);

    return this.prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: leadInclude,
    });
  }

  async addInteraction(
    leadId: string,
    userId: string,
    role: UserRole,
    body: { type: string; notes?: string },
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: leadInclude,
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (!(await this.canAccessLead(lead, userId, role))) {
      throw new ForbiddenException('Sem permissão');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leadInteraction.create({
        data: {
          leadId,
          userId,
          type: sanitizeInput(body.type),
          body: body.notes ? sanitizeInput(body.notes) : null,
        },
      });
      const count = lead.interactionCount + 1;
      const isHot = count >= HOT_INTERACTION_THRESHOLD;
      await tx.lead.update({
        where: { id: leadId },
        data: { interactionCount: count, isHot },
      });
    });

    const updated = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: leadInclude,
    });
    if (updated?.lotId) {
      await this.scoring.recalculateLotDevelopmentByLotId(updated.lotId);
    }
    await this.closing.recalculateLead(leadId);
    return updated;
  }

  async recordPublicTouch(leadId: string, ip?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead não encontrado');

    const count = lead.interactionCount + 1;
    const isHot = count >= HOT_INTERACTION_THRESHOLD;

    await this.prisma.$transaction([
      this.prisma.leadInteraction.create({
        data: {
          leadId,
          type: 'VISITA_PAGINA',
          body: ip ? `IP ${ip}` : null,
        },
      }),
      this.prisma.lead.update({
        where: { id: leadId },
        data: { interactionCount: count, isHot },
      }),
    ]);

    if (lead.lotId) {
      await this.scoring.recalculateLotDevelopmentByLotId(lead.lotId);
    }

    await this.closing.recalculateLead(leadId);

    return { ok: true, interactionCount: count, isHot };
  }
}
