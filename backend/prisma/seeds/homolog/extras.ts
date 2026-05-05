import {
  AiSuggestionMessageType,
  AiSuggestionTone,
  DailyAvailabilitySourceType,
  LotDailySnapshotStatus,
  PrismaClient,
} from '@prisma/client';
import type { HomologSeedContext } from './types';
import { HOMOLOG_SOURCE } from './types';

export async function seedHomologExtras(prisma: PrismaClient, ctx: HomologSeedContext): Promise<void> {
  console.log('[homolog] extras — IA, auditoria, disponibilidade do dia (amostra)…');

  const broker = ctx.brokers[0]!;
  const lead = await prisma.lead.findFirst({
    where: { source: HOMOLOG_SOURCE },
    orderBy: { createdAt: 'asc' },
  });
  const lot = await prisma.lot.findFirst({
    where: { block: { developmentId: ctx.vistaVerdeId } },
    select: { id: true },
  });

  if (lead && lot) {
    const exists = await prisma.aiMessageSuggestion.findFirst({
      where: { userId: broker.id, leadId: lead.id, message: { startsWith: '[homolog]' } },
    });
    if (!exists) {
      await prisma.aiMessageSuggestion.create({
        data: {
          userId: broker.id,
          leadId: lead.id,
          lotId: lot.id,
          messageType: AiSuggestionMessageType.OPORTUNIDADE,
          tone: AiSuggestionTone.CONSULTIVO,
          message:
            '[homolog] Olá! Temos novidades no loteamento que combinam com o que você buscou. Posso enviar opções?',
          justification: 'Sugestão fictícia gerada no seed de homologação (não é LLM).',
        },
      });
    }
  }

  const logExists = await prisma.activityLog.findFirst({
    where: { userId: ctx.admin2Id, action: `${HOMOLOG_SOURCE}_SEED` },
  });
  if (!logExists) {
    await prisma.activityLog.create({
      data: {
        userId: ctx.admin2Id,
        action: `${HOMOLOG_SOURCE}_SEED`,
        entity: 'System',
        entityId: 'homolog',
        metadata: { message: 'Seed de homologação aplicado (idempotente).' },
      },
    });
  }

  /** Um snapshot de disponibilidade do dia em Vista Verde (não dispara e-mail; apenas dados). */
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const date = new Date(`${today}T12:00:00.000Z`);

  const lots = await prisma.lot.findMany({
    where: { block: { developmentId: ctx.vistaVerdeId } },
    take: 12,
    select: { id: true, status: true },
  });
  if (lots.length) {
    const marker = `${HOMOLOG_SOURCE}_daily_${today}`;
    const dup = await prisma.dailyAvailability.findFirst({
      where: { developmentId: ctx.vistaVerdeId, date, notes: marker },
    });
    if (!dup) {
      const statuses: LotDailySnapshotStatus[] = [
        LotDailySnapshotStatus.DISPONIVEL,
        LotDailySnapshotStatus.DISPONIVEL,
        LotDailySnapshotStatus.RESERVADO,
        LotDailySnapshotStatus.NEGOCIACAO,
        LotDailySnapshotStatus.DISPONIVEL,
      ];
      await prisma.dailyAvailability.create({
        data: {
          developmentId: ctx.vistaVerdeId,
          date,
          sourceType: DailyAvailabilitySourceType.MANUAL,
          notes: marker,
          createdById: broker.id,
          lotSnapshots: {
            create: lots.map((l, i) => ({
              lotId: l.id,
              status: statuses[i % statuses.length]!,
            })),
          },
        },
      });
    }
  }
}
