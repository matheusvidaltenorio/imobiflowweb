import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatConversationType,
  ChatMessageType,
  LeadStatus,
  Prisma,
  PropertyStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VisitsService } from '../visits/visits.service';
import { LotsService } from '../lots/lots.service';
import { ProposalsService } from '../proposals/proposals.service';
import { CatalogShareService } from '../catalog-share/catalog-share.service';
import { SimulationsService } from '../simulations/simulations.service';
import { sanitizeInput } from '../common/utils/xss.util';

const SYSTEM_WELCOME =
  'Conversa registrada para sua segurança. Evite negociações e pagamentos fora da plataforma.';

const leadChatInclude = {
  property: { select: { userId: true, title: true, price: true } },
  lot: { include: { block: { select: { developmentId: true } } } },
  developmentId: true,
} as const;

const CONV_LIST_INCLUDE = {
  lead: {
    select: { id: true, name: true, email: true, status: true },
  },
  lot: {
    select: {
      id: true,
      number: true,
      block: { select: { name: true, development: { select: { name: true } } } },
    },
  },
  property: { select: { id: true, title: true } },
  brokerUser: { select: { id: true, name: true } },
  clientUser: { select: { id: true, name: true } },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.ConversationInclude;

type ConversationListRow = Prisma.ConversationGetPayload<{ include: typeof CONV_LIST_INCLUDE }>;

type LeadForChat = Prisma.LeadGetPayload<{ include: typeof leadChatInclude }>;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visits: VisitsService,
    private readonly lots: LotsService,
    private readonly proposals: ProposalsService,
    private readonly catalogs: CatalogShareService,
    private readonly simulations: SimulationsService,
  ) {}

  private async canBrokerAccessLead(lead: LeadForChat, userId: string, role: UserRole): Promise<boolean> {
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

  private async assertLeadChatAccess(lead: LeadForChat, userId: string, role: UserRole) {
    if (role === UserRole.CLIENTE) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (u && lead.email.toLowerCase() === u.email.toLowerCase()) return;
      const cid = await this.resolveClientUserId(lead);
      if (cid === userId) return;
      throw new ForbiddenException('Sem permissão para este chat');
    }
    if (!(await this.canBrokerAccessLead(lead, userId, role))) {
      throw new ForbiddenException('Sem permissão para este chat');
    }
  }

  async resolveClientUserId(lead: { clientId: string | null; email: string }): Promise<string | null> {
    if (lead.clientId) {
      const c = await this.prisma.client.findUnique({
        where: { id: lead.clientId },
        select: { email: true },
      });
      if (c?.email) {
        const u = await this.prisma.user.findFirst({
          where: { email: c.email, role: UserRole.CLIENTE },
        });
        return u?.id ?? null;
      }
    }
    const u = await this.prisma.user.findFirst({
      where: { email: lead.email, role: UserRole.CLIENTE },
    });
    return u?.id ?? null;
  }

  private async syncParticipants(conversationId: string, userIds: string[]) {
    const uniq = [...new Set(userIds.filter(Boolean))];
    for (const uid of uniq) {
      await this.prisma.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId: uid } },
        create: { conversationId, userId: uid },
        update: {},
      });
    }
  }

  private async assertConvAccess(conversationId: string, userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      const c = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!c) throw new NotFoundException('Conversa não encontrada');
      return c;
    }
    const c = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { brokerUserId: userId },
          { clientUserId: userId },
          { participants: { some: { userId } } },
        ],
      },
    });
    if (!c) throw new ForbiddenException('Sem permissão');
    return c;
  }

  async ensureLeadConversation(leadId: string, actorId: string, role: UserRole) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: leadChatInclude,
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    await this.assertLeadChatAccess(lead, actorId, role);

    let brokerId = lead.userId;
    if (!brokerId && role === UserRole.CORRETOR) {
      await this.prisma.lead.update({ where: { id: leadId }, data: { userId: actorId } });
      brokerId = actorId;
    }
    if (!brokerId && role === UserRole.ADMIN) {
      brokerId = actorId;
    }
    if (!brokerId) {
      throw new BadRequestException('Atribua um corretor ao lead (ou abra como corretor) para usar o chat.');
    }

    const clientUserId = await this.resolveClientUserId(lead);

    let conv = await this.prisma.conversation.findUnique({ where: { leadId } });
    if (conv) {
      const patch: Prisma.ConversationUpdateInput = {};
      if (conv.brokerUserId !== brokerId) patch.brokerUser = { connect: { id: brokerId } };
      if (clientUserId && conv.clientUserId !== clientUserId) {
        patch.clientUser = { connect: { id: clientUserId } };
      }
      if (Object.keys(patch).length) {
        conv = await this.prisma.conversation.update({ where: { id: conv.id }, data: patch });
      }
      await this.syncParticipants(conv.id, [brokerId, ...(clientUserId ? [clientUserId] : [])]);
      return { conversation: await this.formatConversation(conv.id, actorId), created: false };
    }

    conv = await this.prisma.conversation.create({
      data: {
        type: ChatConversationType.LEAD,
        leadId,
        brokerUserId: brokerId,
        clientUserId,
        participants: {
          create: [{ userId: brokerId }, ...(clientUserId ? [{ userId: clientUserId }] : [])],
        },
        messages: {
          create: [{ type: ChatMessageType.SYSTEM, content: SYSTEM_WELCOME }],
        },
      },
    });
    return { conversation: await this.formatConversation(conv.id, actorId), created: true };
  }

  async ensureLotConversation(lotId: string, clientUserId: string, actorId: string, role: UserRole) {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { block: true },
    });
    if (!lot) throw new NotFoundException('Lote não encontrado');

    if (role === UserRole.CLIENTE) {
      if (clientUserId !== actorId) throw new ForbiddenException();
    }

    let brokerId: string;
    if (role === UserRole.CORRETOR) {
      const p = await this.prisma.property.findFirst({
        where: { userId: actorId, developmentId: lot.block.developmentId },
      });
      if (!p) throw new ForbiddenException('Sem permissão neste loteamento');
      brokerId = actorId;
    } else if (role === UserRole.ADMIN) {
      const p = await this.prisma.property.findFirst({
        where: { developmentId: lot.block.developmentId },
        select: { userId: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!p) throw new BadRequestException('Nenhum corretor com imóvel neste loteamento.');
      brokerId = p.userId;
    } else {
      const p = await this.prisma.property.findFirst({
        where: { developmentId: lot.block.developmentId },
        select: { userId: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!p) throw new BadRequestException('Corretor não encontrado para o loteamento.');
      brokerId = p.userId;
    }

    let conv = await this.prisma.conversation.findFirst({
      where: { type: ChatConversationType.LOT, lotId, clientUserId },
    });
    if (conv) {
      await this.syncParticipants(conv.id, [brokerId, clientUserId]);
      return { conversation: await this.formatConversation(conv.id, actorId), created: false };
    }

    conv = await this.prisma.conversation.create({
      data: {
        type: ChatConversationType.LOT,
        lotId,
        brokerUserId: brokerId,
        clientUserId,
        participants: {
          create: [{ userId: brokerId }, { userId: clientUserId }],
        },
        messages: {
          create: [{ type: ChatMessageType.SYSTEM, content: SYSTEM_WELCOME }],
        },
      },
    });
    return { conversation: await this.formatConversation(conv.id, actorId), created: true };
  }

  async listMine(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      const rows = await this.prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 80,
        include: CONV_LIST_INCLUDE,
      });
      return Promise.all(rows.map((r) => this.serializeListRow(r, userId)));
    }
    const rows = await this.prisma.conversation.findMany({
      where: {
        OR: [
          { brokerUserId: userId },
          { clientUserId: userId },
          { participants: { some: { userId } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      include: CONV_LIST_INCLUDE,
    });
    return Promise.all(rows.map((r) => this.serializeListRow(r, userId)));
  }

  private async serializeListRow(row: ConversationListRow, viewerId: string) {
    const unread = await this.unreadCountFor(row.id, viewerId);
    const last = row.messages[0];
    return {
      id: row.id,
      type: row.type,
      title: this.conversationTitle(row),
      subtitle: row.lead?.status ?? null,
      updatedAt: row.updatedAt.toISOString(),
      whatsappHandoffAt: row.whatsappHandoffAt?.toISOString() ?? null,
      lastMessagePreview: last ? last.content.slice(0, 120) : null,
      lastMessageAt: last?.createdAt.toISOString() ?? null,
      unreadCount: unread,
      leadId: row.leadId,
      lotId: row.lotId,
      propertyId: row.propertyId,
    };
  }

  private conversationTitle(row: ConversationListRow): string {
    if (row.lead) return `${row.lead.name} — ${row.lead.email}`;
    if (row.lot)
      return `Lote ${row.lot.number} (${row.lot.block.development?.name ?? row.lot.block.name})`;
    if (row.property) return row.property.title;
    return 'Conversa';
  }

  async unreadTotal(userId: string, role: UserRole): Promise<number> {
    const convs = await this.listMine(userId, role);
    return convs.reduce((a, c) => a + (c.unreadCount ?? 0), 0);
  }

  private async unreadCountFor(conversationId: string, viewerId: string): Promise<number> {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: viewerId } },
    });
    const lastRead = part?.lastReadAt;
    return this.prisma.chatMessage.count({
      where: {
        conversationId,
        NOT: { senderId: viewerId },
        ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
      },
    });
  }

  async getConversation(id: string, userId: string, role: UserRole) {
    await this.assertConvAccess(id, userId, role);
    return this.formatConversation(id, userId);
  }

  private async formatConversation(id: string, viewerId: string) {
    const row = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        ...CONV_LIST_INCLUDE,
        participants: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });
    if (!row) throw new NotFoundException();
    const unread = await this.unreadCountFor(id, viewerId);
    return {
      id: row.id,
      type: row.type,
      title: this.conversationTitle(row),
      leadId: row.leadId,
      lotId: row.lotId,
      propertyId: row.propertyId,
      whatsappHandoffAt: row.whatsappHandoffAt?.toISOString() ?? null,
      brokerUser: row.brokerUser,
      clientUser: row.clientUser,
      participants: row.participants.map((p) => p.user),
      unreadCount: unread,
    };
  }

  async getMessages(conversationId: string, userId: string, role: UserRole, cursor?: string) {
    await this.assertConvAccess(conversationId, userId, role);
    const take = 40;
    const where: Prisma.ChatMessageWhereInput = { conversationId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }
    const batch = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    const chronological = [...batch].reverse();
    const mapped = chronological.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      metadata: m.metadata,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
    }));
    const oldest = chronological[0];
    return {
      messages: mapped,
      nextCursor: batch.length === take && oldest ? oldest.createdAt.toISOString() : null,
    };
  }

  async postMessage(conversationId: string, userId: string, role: UserRole, content: string) {
    await this.assertConvAccess(conversationId, userId, role);
    const text = sanitizeInput(content.trim());
    if (!text) throw new BadRequestException('Mensagem vazia');
    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        type: ChatMessageType.TEXT,
        content: text,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await this.notifyOthers(conversationId, userId, text);
    return {
      id: msg.id,
      content: msg.content,
      type: msg.type,
      createdAt: msg.createdAt.toISOString(),
      sender: msg.sender,
    };
  }

  async markRead(conversationId: string, userId: string, role: UserRole) {
    await this.assertConvAccess(conversationId, userId, role);
    await this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  private async notifyOthers(conversationId: string, senderId: string, preview: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { brokerUserId: true, clientUserId: true, participants: { select: { userId: true } } },
    });
    if (!conv) return;
    const targets = new Set<string>();
    targets.add(conv.brokerUserId);
    if (conv.clientUserId) targets.add(conv.clientUserId);
    for (const p of conv.participants) targets.add(p.userId);
    targets.delete(senderId);
    for (const uid of targets) {
      await this.prisma.inAppNotification.create({
        data: {
          userId: uid,
          type: 'CHAT_MESSAGE',
          title: 'Nova mensagem no chat comercial',
          body: preview.length > 160 ? `${preview.slice(0, 157)}…` : preview,
          metadataJson: { conversationId } as object,
        },
      });
    }
  }

  async appendSystemMessage(conversationId: string, text: string, metadata?: object) {
    await this.prisma.chatMessage.create({
      data: {
        conversationId,
        type: ChatMessageType.SYSTEM,
        content: text,
        metadata: metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue),
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  async onLeadStatusChanged(leadId: string, from: LeadStatus, to: LeadStatus) {
    const conv = await this.prisma.conversation.findUnique({ where: { leadId } });
    if (!conv) return;
    await this.appendSystemMessage(conv.id, `Status do negócio alterado: ${from} → ${to}.`);
  }

  async whatsappHandoff(conversationId: string, userId: string, role: UserRole, phone?: string) {
    await this.assertConvAccess(conversationId, userId, role);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { whatsappHandoffAt: new Date() },
    });
    const extra = phone ? ` (${phone})` : '';
    await this.appendSystemMessage(
      conversationId,
      `Continuação da conversa iniciada no WhatsApp${extra}. Registro mantido para auditoria.`,
      { channel: 'whatsapp' },
    );
    return { ok: true };
  }

  private async loadLeadContext(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: {
          include: {
            property: { select: { id: true, userId: true, price: true } },
            lot: { select: { id: true, price: true, block: { select: { developmentId: true } } } },
          },
        },
      },
    });
    if (!conv?.lead) throw new BadRequestException('Ações disponíveis apenas em conversas de lead.');
    return { conv, lead: conv.lead };
  }

  async actionScheduleVisit(
    conversationId: string,
    userId: string,
    role: UserRole,
    body: { scheduledAt: string; notes?: string },
  ) {
    await this.assertConvAccess(conversationId, userId, role);
    if (role === UserRole.CLIENTE) throw new ForbiddenException('Apenas corretor ou admin.');
    const { lead } = await this.loadLeadContext(conversationId);
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Data inválida');

    await this.visits.create(userId, role, {
      leadId: lead.id,
      lotId: lead.lotId ?? undefined,
      propertyId: lead.propertyId ?? undefined,
      clientId: lead.clientId ?? undefined,
      scheduledAt,
      notes: body.notes,
    });

    await this.appendSystemMessage(
      conversationId,
      `Visita agendada para ${scheduledAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
      { action: 'VISIT_SCHEDULED' },
    );
    return { ok: true };
  }

  async actionProposal(conversationId: string, userId: string, role: UserRole) {
    await this.assertConvAccess(conversationId, userId, role);
    if (role === UserRole.CLIENTE) throw new ForbiddenException();
    const { lead } = await this.loadLeadContext(conversationId);
    if (!lead.clientId || !lead.propertyId) {
      throw new BadRequestException('Associe cliente e imóvel ao lead para criar proposta.');
    }
    await this.proposals.create(userId, role, {
      clientId: lead.clientId,
      propertyId: lead.propertyId,
      bank: 'Chat interno',
      installment: 1800,
      months: 360,
      downPayment: 36000,
    });
    await this.appendSystemMessage(conversationId, 'Proposta registrada no sistema (rascunho).', {
      action: 'PROPOSAL',
    });
    return { ok: true };
  }

  async actionReserveLot(conversationId: string, userId: string, role: UserRole) {
    await this.assertConvAccess(conversationId, userId, role);
    if (role === UserRole.CLIENTE) throw new ForbiddenException();
    const { lead } = await this.loadLeadContext(conversationId);
    if (!lead.lotId) throw new BadRequestException('Lead sem lote associado.');
    await this.lots.setStatus(lead.lotId, PropertyStatus.RESERVADO);
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { status: LeadStatus.RESERVADO },
    });
    await this.appendSystemMessage(conversationId, 'Lote marcado como reservado.', {
      action: 'LOT_RESERVED',
    });
    return { ok: true };
  }

  async actionCatalog(conversationId: string, userId: string, role: UserRole) {
    await this.assertConvAccess(conversationId, userId, role);
    if (role === UserRole.CLIENTE) throw new ForbiddenException();
    const { lead } = await this.loadLeadContext(conversationId);
    const share = await this.catalogs.create(userId, role, {
      title: `Catálogo — ${lead.name}`,
      message: 'Seleção enviada pelo chat comercial.',
      leadId: lead.id,
      clientId: lead.clientId ?? undefined,
    });
    const items: Array<{ lotId?: string; propertyId?: string; sortOrder?: number }> = [];
    if (lead.lotId) items.push({ lotId: lead.lotId, sortOrder: 0 });
    if (lead.propertyId) items.push({ propertyId: lead.propertyId, sortOrder: items.length });
    if (items.length) await this.catalogs.setItems(userId, role, share.id, items);
    await this.catalogs.markSent(userId, role, share.id);
    await this.appendSystemMessage(
      conversationId,
      'Catálogo de oportunidades enviado ao cliente (link disponível no painel de catálogos).',
      { action: 'CATALOG_SENT', catalogShareId: share.id },
    );
    return { catalogShareId: share.id, shareToken: share.shareToken };
  }

  async actionSimulation(conversationId: string, userId: string, role: UserRole) {
    await this.assertConvAccess(conversationId, userId, role);
    if (role === UserRole.CLIENTE) throw new ForbiddenException();
    const { lead } = await this.loadLeadContext(conversationId);
    const pvRaw = lead.property?.price ?? lead.lot?.price;
    const propertyValue = pvRaw != null ? Number(pvRaw) : 250000;
    const downPayment = Math.round(propertyValue * 0.2 * 100) / 100;
    await this.simulations.compare(userId, role, {
      clientName: lead.name,
      cpf: '11144477735',
      income: 9000,
      propertyValue,
      downPayment,
      clientId: lead.clientId ?? undefined,
      propertyId: lead.propertyId ?? undefined,
      lotId: lead.lotId ?? undefined,
      save: true,
      age: 34,
      maritalStatus: 'SOLTEIRO',
      dependents: 0,
    });
    await this.appendSystemMessage(
      conversationId,
      'Simulação de financiamento gerada e salva em Simulações.',
      { action: 'SIMULATION' },
    );
    return { ok: true };
  }
}
