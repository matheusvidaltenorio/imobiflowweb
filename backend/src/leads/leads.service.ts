import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, LeadStatus, PropertyStatus, Prisma } from '@prisma/client';
import { sanitizeInput } from '../common/utils/xss.util';
import { LotScoringService } from '../lot-scoring/lot-scoring.service';
import { ClosingPredictionService } from '../closing-prediction/closing-prediction.service';
import { AuditService } from '../audit/audit.service';
import { ChatService } from '../chat/chat.service';

const HOT_INTERACTION_THRESHOLD = 3;
const ALLOWED_LEAD_SOURCES = [
  'WHATSAPP',
  'SITE',
  'INDICACAO',
  'INSTAGRAM',
  'FACEBOOK',
  'OUTRO',
  'TRÁFEGO_PAGO',
  'TRAFICO_PAGO',
] as const;

/** Ações rápidas do CRM (lead detail / pipeline). */
export type CommercialLeadAction =
  | 'WHATSAPP'
  | 'PROPOSTA'
  | 'RESERVA'
  | 'VENDA'
  | 'PERDA';

const leadInclude = {
  property: { select: { id: true, title: true, price: true, userId: true } },
  development: { select: { id: true, name: true, city: true } },
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
  interactions: { orderBy: { createdAt: 'desc' as const }, take: 50 },
  marketingCampaign: { select: { id: true, title: true } },
} as const;

export type LeadsListFilters = {
  status?: LeadStatus;
  developmentId?: string;
  assignedUserId?: string;
  leadSource?: string;
  from?: string;
  to?: string;
  priority?: 'hot' | 'stale';
};

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private scoring: LotScoringService,
    private closing: ClosingPredictionService,
    private audit: AuditService,
    private chat: ChatService,
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

  private async activityOwnerForDevelopment(developmentId: string): Promise<string> {
    const prop = await this.prisma.property.findFirst({
      where: { developmentId },
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

  private async resolveMarketingCampaignForPublicLead(
    marketingCampaignId: string | undefined,
    ctx:
      | { kind: 'property'; property: { developmentId: string | null } }
      | { kind: 'lot'; lotId: string }
      | { kind: 'development'; development: { id: string } },
  ): Promise<string | undefined> {
    if (!marketingCampaignId) return undefined;

    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: marketingCampaignId },
      select: { id: true, developmentId: true, lotId: true, blockId: true },
    });
    if (!campaign) {
      throw new BadRequestException('Campanha de marketing inválida');
    }

    if (ctx.kind === 'property') {
      if (campaign.lotId || campaign.blockId) {
        throw new BadRequestException('Esta campanha não corresponde ao contexto do imóvel');
      }
      if (campaign.developmentId && ctx.property.developmentId !== campaign.developmentId) {
        throw new BadRequestException('Esta campanha não corresponde ao empreendimento do imóvel');
      }
      return campaign.id;
    }

    if (ctx.kind === 'lot') {
      const lot = await this.prisma.lot.findUnique({
        where: { id: ctx.lotId },
        include: { block: true },
      });
      if (!lot) throw new NotFoundException('Lote não encontrado');

      if (campaign.lotId) {
        if (campaign.lotId !== ctx.lotId) {
          throw new BadRequestException('Esta campanha não corresponde ao lote informado');
        }
        return campaign.id;
      }
      if (campaign.blockId) {
        if (lot.blockId !== campaign.blockId) {
          throw new BadRequestException('Esta campanha não corresponde à quadra do lote');
        }
        return campaign.id;
      }
      if (campaign.developmentId) {
        if (lot.block.developmentId !== campaign.developmentId) {
          throw new BadRequestException('Esta campanha não corresponde ao loteamento do lote');
        }
        return campaign.id;
      }
      return campaign.id;
    }

    if (campaign.lotId || campaign.blockId) {
      throw new BadRequestException(
        'Esta campanha é específica de lote ou quadra e não pode ser usada neste formulário',
      );
    }
    if (campaign.developmentId && campaign.developmentId !== ctx.development.id) {
      throw new BadRequestException('Esta campanha não corresponde ao loteamento informado');
    }
    return campaign.id;
  }

  async create(
    data: {
      propertyId?: string;
      lotId?: string;
      developmentId?: string;
      marketingCampaignId?: string;
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
    const keys = [data.propertyId, data.lotId, data.developmentId].filter(Boolean);
    if (keys.length !== 1) {
      throw new BadRequestException('Informe exatamente um de: propertyId, lotId ou developmentId');
    }

    let activityUserId: string;
    let resolvedMarketingCampaignId: string | undefined;

    if (data.propertyId) {
      const property = await this.prisma.property.findUnique({ where: { id: data.propertyId } });
      if (!property) throw new NotFoundException('Imóvel não encontrado');
      activityUserId = property.userId;
      resolvedMarketingCampaignId = await this.resolveMarketingCampaignForPublicLead(
        data.marketingCampaignId,
        { kind: 'property', property },
      );
    } else if (data.lotId) {
      activityUserId = await this.activityOwnerForLot(data.lotId);
      resolvedMarketingCampaignId = await this.resolveMarketingCampaignForPublicLead(
        data.marketingCampaignId,
        { kind: 'lot', lotId: data.lotId },
      );
    } else {
      const dev = await this.prisma.development.findUnique({ where: { id: data.developmentId! } });
      if (!dev) throw new NotFoundException('Loteamento não encontrado');
      activityUserId = await this.activityOwnerForDevelopment(data.developmentId!);
      resolvedMarketingCampaignId = await this.resolveMarketingCampaignForPublicLead(
        data.marketingCampaignId,
        { kind: 'development', development: dev },
      );
    }

    const src = data.leadSource?.toUpperCase().replace('Á', 'A');
    const normalizedSrc =
      src === 'TRAFICO_PAGO' || src === 'TRÁFEGO_PAGO' ? 'TRAFICO_PAGO' : src;
    const leadSource =
      normalizedSrc && (ALLOWED_LEAD_SOURCES as readonly string[]).includes(normalizedSrc)
        ? normalizedSrc
        : undefined;

    const lead = await this.prisma.lead.create({
      data: {
        propertyId: data.propertyId ?? null,
        lotId: data.lotId ?? null,
        developmentId: data.developmentId ?? null,
        userId: data.userId,
        clientId: data.clientId,
        name: sanitizeInput(data.name),
        email: sanitizeInput(data.email),
        phone: data.phone,
        message: data.message ? sanitizeInput(data.message) : null,
        source: data.source,
        leadSource: leadSource ?? data.source,
        interactionCount: 1,
        marketingCampaignId: resolvedMarketingCampaignId ?? null,
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
        metadata: {
          propertyId: data.propertyId,
          lotId: data.lotId,
          developmentId: data.developmentId,
          marketingCampaignId: resolvedMarketingCampaignId,
        } as object,
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
    filters?: LeadsListFilters,
  ) {
    const propertyRows = await this.prisma.property.findMany({
      where: role === UserRole.ADMIN ? {} : { userId },
      select: { id: true },
    });
    const propertyIds = propertyRows.map((p) => p.id);

    const devIds = await this.brokerDevelopmentIds(userId, role);

    const or: Prisma.LeadWhereInput[] = [];
    if (propertyIds.length) or.push({ propertyId: { in: propertyIds } });
    if (role === UserRole.ADMIN) {
      or.push({ lotId: { not: null } });
      or.push({ developmentId: { not: null } });
    } else if (devIds.length) {
      or.push({
        lot: { block: { developmentId: { in: devIds } } },
      });
      or.push({ developmentId: { in: devIds } });
    }

    if (!or.length) return [];

    const and: Prisma.LeadWhereInput[] = [{ OR: or }];

    if (filters?.status) and.push({ status: filters.status });
    if (filters?.assignedUserId) and.push({ userId: filters.assignedUserId });
    if (filters?.leadSource) {
      and.push({
        OR: [{ leadSource: filters.leadSource }, { source: filters.leadSource }],
      });
    }
    if (filters?.developmentId) {
      and.push({
        OR: [
          { developmentId: filters.developmentId },
          { lot: { block: { developmentId: filters.developmentId } } },
        ],
      });
    }
    if (filters?.from || filters?.to) {
      and.push({
        createdAt: {
          ...(filters.from ? { gte: new Date(filters.from) } : {}),
          ...(filters.to ? { lte: new Date(filters.to) } : {}),
        },
      });
    }
    if (filters?.priority === 'hot') {
      and.push({ isHot: true });
    }
    if (filters?.priority === 'stale') {
      const cutoff = new Date(Date.now() - 7 * 86400000);
      and.push({
        OR: [
          { leadLastInteractionAt: { lt: cutoff } },
          { leadLastInteractionAt: null },
        ],
      });
    }

    const orderBy =
      sort === 'closing'
        ? [{ closingScore: 'desc' as const }, { createdAt: 'desc' as const }]
        : sort === 'risk'
          ? [{ closingScore: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'recent'
            ? [{ leadLastInteractionAt: 'desc' as const }, { createdAt: 'desc' as const }]
            : { createdAt: 'desc' as const };

    return this.prisma.lead.findMany({
      where: { AND: and },
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
    lead: {
      property?: { userId: string } | null;
      lot?: { block: { developmentId: string } } | null;
      developmentId?: string | null;
    },
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
    if (lead.developmentId) {
      const p = await this.prisma.property.findFirst({
        where: { userId, developmentId: lead.developmentId },
      });
      return !!p;
    }
    return false;
  }

  async patchLead(
    leadId: string,
    userId: string,
    role: UserRole,
    data: {
      notes?: string | null;
      nextFollowUpAt?: string | null;
      developmentId?: string | null;
      assignedUserId?: string | null;
      clientId?: string | null;
      lostReason?: string | null;
    },
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: leadInclude,
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (!(await this.canAccessLead(lead, userId, role))) {
      throw new ForbiddenException('Sem permissão');
    }

    const patch: Prisma.LeadUpdateInput = {};
    if (data.notes !== undefined) patch.notes = data.notes ? sanitizeInput(data.notes) : null;
    if (data.nextFollowUpAt !== undefined) {
      patch.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
    }
    if (data.developmentId !== undefined) {
      patch.development = data.developmentId
        ? { connect: { id: data.developmentId } }
        : { disconnect: true };
    }
    if (data.assignedUserId !== undefined) {
      patch.user = data.assignedUserId
        ? { connect: { id: data.assignedUserId } }
        : { disconnect: true };
    }
    if (data.clientId !== undefined) {
      patch.client = data.clientId ? { connect: { id: data.clientId } } : { disconnect: true };
    }
    if (data.lostReason !== undefined) {
      patch.lostReason = data.lostReason ? sanitizeInput(data.lostReason) : null;
    }

    await this.prisma.lead.update({
      where: { id: leadId },
      data: patch,
    });

    await this.closing.recalculateLead(leadId);

    return this.prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: leadInclude,
    });
  }

  /**
   * Ações comerciais rápidas: atualizam estágio, lote e registram interação.
   * RESERVA/VENDA exigem lote vinculado ao lead.
   */
  async commercialAction(
    leadId: string,
    userId: string,
    role: UserRole,
    action: CommercialLeadAction,
    payload?: { lostReason?: string },
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: leadInclude,
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (!(await this.canAccessLead(lead, userId, role))) {
      throw new ForbiddenException('Sem permissão');
    }

    switch (action) {
      case 'WHATSAPP':
        await this.addInteraction(leadId, userId, role, {
          type: 'WHATSAPP',
          notes: 'Contato / intenção WhatsApp',
        });
        break;

      case 'PROPOSTA':
        await this.updateStatus(leadId, userId, role, LeadStatus.PROPOSTA_ENVIADA);
        await this.addInteraction(leadId, userId, role, {
          type: 'PROPOSTA',
          notes: 'Proposta enviada (ação rápida)',
        });
        break;

      case 'RESERVA':
        if (!lead.lotId) {
          throw new BadRequestException('Associe um lote ao lead para marcar reserva');
        }
        await this.prisma.$transaction([
          this.prisma.lot.update({
            where: { id: lead.lotId },
            data: { status: PropertyStatus.RESERVADO },
          }),
          this.prisma.lead.update({
            where: { id: leadId },
            data: { status: LeadStatus.RESERVADO },
          }),
          this.prisma.leadInteraction.create({
            data: {
              leadId,
              userId,
              type: 'RESERVA',
              body: 'Lote marcado como reservado',
            },
          }),
        ]);
        await this.scoring.recalculateLotDevelopmentByLotId(lead.lotId);
        await this.closing.recalculateLead(leadId);
        break;

      case 'VENDA':
        if (!lead.lotId) {
          throw new BadRequestException('Associe um lote ao lead para marcar venda');
        }
        await this.prisma.$transaction([
          this.prisma.lot.update({
            where: { id: lead.lotId },
            data: { status: PropertyStatus.VENDIDO },
          }),
          this.prisma.lead.update({
            where: { id: leadId },
            data: { status: LeadStatus.VENDIDO },
          }),
          this.prisma.leadInteraction.create({
            data: {
              leadId,
              userId,
              type: 'VENDA',
              body: 'Venda registrada no pipeline',
            },
          }),
        ]);
        await this.scoring.recalculateLotDevelopmentByLotId(lead.lotId);
        await this.closing.recalculateLead(leadId);
        break;

      case 'PERDA': {
        const reason = payload?.lostReason?.trim()
          ? sanitizeInput(payload.lostReason)
          : 'Marcado como perdido (ação rápida)';
        await this.prisma.lead.update({
          where: { id: leadId },
          data: {
            status: LeadStatus.PERDIDO,
            lostReason: reason,
          },
        });
        await this.prisma.leadInteraction.create({
          data: {
            leadId,
            userId,
            type: 'PERDA',
            body: reason,
          },
        });
        await this.closing.recalculateLead(leadId);
        break;
      }

      default:
        throw new BadRequestException('Ação inválida');
    }

    return this.prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: leadInclude,
    });
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

    const wasPastProposta =
      lead.status === LeadStatus.PROPOSTA_ENVIADA ||
      lead.status === LeadStatus.RESERVADO ||
      lead.status === LeadStatus.VENDIDO;
    const nowProposta = status === LeadStatus.PROPOSTA_ENVIADA;

    await this.prisma.$transaction(async (tx) => {
      if (lead.lotId && !wasPastProposta && nowProposta) {
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

    if (lead.status !== status) {
      void this.audit.logChange({
        userId,
        action: 'LEAD_STATUS_UPDATE',
        entity: 'Lead',
        entityId: leadId,
        before: { status: lead.status },
        after: { status },
      });
      void this.chat.onLeadStatusChanged(leadId, lead.status, status);
    }

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
        data: {
          interactionCount: count,
          isHot,
          leadLastInteractionAt: new Date(),
        },
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
        data: {
          interactionCount: count,
          isHot,
          leadLastInteractionAt: new Date(),
        },
      }),
    ]);

    if (lead.lotId) {
      await this.scoring.recalculateLotDevelopmentByLotId(lead.lotId);
    }

    await this.closing.recalculateLead(leadId);

    return { ok: true, interactionCount: count, isHot };
  }
}
