import { Injectable, Logger } from '@nestjs/common';
import { LeadStatus, LotDailySnapshotStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchEngineService } from '../matching/match-engine.service';
import {
  AVAIL_ALERT_AGGREGATE_THRESHOLD,
  AVAIL_ALERT_MAX_INDIVIDUAL_PER_BROKER,
  AVAIL_MATCH_SCORE_MIN,
  AvailAlertType,
} from './availability-alert.constants';
import { AvailabilityChangeDetectionService, type LotSnapRow } from './availability-change-detection.service';

function spTodayIsoDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function statusLabel(s: LotDailySnapshotStatus): string {
  switch (s) {
    case LotDailySnapshotStatus.DISPONIVEL:
      return 'Disponível';
    case LotDailySnapshotStatus.RESERVADO:
      return 'Reservado';
    case LotDailySnapshotStatus.VENDIDO:
      return 'Vendido';
    case LotDailySnapshotStatus.NEGOCIACAO:
      return 'Negociação';
    default:
      return String(s);
  }
}

@Injectable()
export class AvailabilityAlertDispatchService {
  private readonly log = new Logger(AvailabilityAlertDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly detection: AvailabilityChangeDetectionService,
    private readonly matchEngine: MatchEngineService,
  ) {}

  /**
   * Dispara alertas após snapshot publicado (gestora imediata, admin, importação, etc.).
   */
  async onPublishedDailyAvailability(snapshotId: string): Promise<void> {
    try {
      await this.dispatchInternal(snapshotId);
    } catch (e) {
      this.log.warn(`availability alerts dispatch failed for ${snapshotId}: ${(e as Error).message}`);
    }
  }

  private async dispatchInternal(snapshotId: string) {
    const row = await this.prisma.dailyAvailability.findUnique({
      where: { id: snapshotId },
      include: {
        development: { select: { id: true, name: true, city: true } },
        lotSnapshots: { select: { lotId: true, status: true, price: true } },
      },
    });

    if (!row || row.gestoraSubmissionStatus != null) return;
    if (!row.lotSnapshots.length) return;

    const previous = await this.prisma.dailyAvailability.findFirst({
      where: {
        developmentId: row.developmentId,
        date: row.date,
        gestoraSubmissionStatus: null,
        id: { not: row.id },
        createdAt: { lt: row.createdAt },
      },
      orderBy: { createdAt: 'desc' },
      include: { lotSnapshots: { select: { lotId: true, status: true, price: true } } },
    });

    const prevRows: LotSnapRow[] = (previous?.lotSnapshots ?? []).map((s) => ({
      lotId: s.lotId,
      status: s.status,
      price: s.price != null ? Number(s.price) : null,
    }));

    const currRows: LotSnapRow[] = row.lotSnapshots.map((s) => ({
      lotId: s.lotId,
      status: s.status,
      price: s.price != null ? Number(s.price) : null,
    }));

    const events = this.detection.detect(prevRows, currRows);
    if (!events.length) return;

    const brokers = await this.prisma.user.findMany({
      where: {
        role: UserRole.CORRETOR,
        isActive: true,
        properties: { some: { developmentId: row.developmentId } },
      },
      select: { id: true },
    });

    if (!brokers.length) {
      this.log.debug(`no brokers on development ${row.developmentId} for availability alerts`);
      await this.emitMatchAlerts(row.developmentId, snapshotId, events, row.development.name);
      return;
    }

    const lotIds = [...new Set(events.map((e) => e.lotId))];
    const labels = await this.loadLotLabels(lotIds);
    const dateLabel = spTodayIsoDate(row.date);

    const useAggregate = events.length >= AVAIL_ALERT_AGGREGATE_THRESHOLD;
    const individual = useAggregate ? events.slice(0, AVAIL_ALERT_MAX_INDIVIDUAL_PER_BROKER) : events;

    for (const b of brokers) {
      for (const ev of individual) {
        const dup = await this.notificationExists({
          userId: b.id,
          type: ev.kind,
          dailyAvailabilityId: snapshotId,
          lotId: ev.lotId,
        });
        if (dup) continue;

        const { title, body } = this.formatEventMessage(ev, row.development.name, labels.get(ev.lotId), dateLabel);
        await this.prisma.inAppNotification.create({
          data: {
            userId: b.id,
            type: ev.kind,
            title,
            body,
            developmentId: row.developmentId,
            lotId: ev.lotId,
            dailyAvailabilityId: snapshotId,
            metadataJson: {
              source: 'daily_availability',
              developmentId: row.developmentId,
              snapshotId,
              date: dateLabel,
              fromStatus: ev.fromStatus,
              toStatus: ev.toStatus,
              fromPrice: ev.fromPrice,
              toPrice: ev.toPrice,
            } as Prisma.InputJsonValue,
          },
        });
      }

      if (useAggregate) {
        const dupSum = await this.notificationExists({
          userId: b.id,
          type: AvailAlertType.DEVELOPMENT_SUMMARY,
          dailyAvailabilityId: snapshotId,
          lotId: null,
        });
        if (!dupSum) {
          const summaryBody = this.formatAggregateBody(events, labels, row.development.name, dateLabel);
          await this.prisma.inAppNotification.create({
            data: {
              userId: b.id,
              type: AvailAlertType.DEVELOPMENT_SUMMARY,
              title: `${row.development.name}: ${events.length} mudanças na disponibilidade`,
              body: summaryBody,
              developmentId: row.developmentId,
              lotId: null,
              dailyAvailabilityId: snapshotId,
              metadataJson: {
                source: 'daily_availability',
                snapshotId,
                date: dateLabel,
                totalChanges: events.length,
                counts: this.countKinds(events),
              } as Prisma.InputJsonValue,
            },
          });
        }
      }
    }

    await this.emitMatchAlerts(row.developmentId, snapshotId, events, row.development.name);
  }

  private countKinds(events: { kind: string }[]) {
    const m: Record<string, number> = {};
    for (const e of events) m[e.kind] = (m[e.kind] ?? 0) + 1;
    return m;
  }

  private formatAggregateBody(
    events: { kind: string; lotId: string }[],
    labels: Map<string, string>,
    devName: string,
    dateLabel: string,
  ): string {
    const counts = this.countKinds(events);
    const parts = Object.entries(counts).map(([k, n]) => `${k.replace('AVAIL_', '')}: ${n}`);
    const samples = events
      .slice(0, 12)
      .map((e) => labels.get(e.lotId) ?? e.lotId)
      .join(', ');
    return `${devName} · ${dateLabel}. Resumo: ${parts.join(' · ')}. Amostra: ${samples}${events.length > 12 ? '…' : ''}`;
  }

  private formatEventMessage(
    ev: {
      kind: string;
      fromStatus: LotDailySnapshotStatus | null;
      toStatus: LotDailySnapshotStatus;
      fromPrice: number | null;
      toPrice: number | null;
    },
    devName: string,
    lotLabel: string | undefined,
    dateLabel: string,
  ): { title: string; body: string } {
    const label = lotLabel ?? 'Lote';
    switch (ev.kind) {
      case AvailAlertType.LOT_AVAILABLE_NEW:
        return {
          title: `Novo disponível: ${label}`,
          body: `${devName} (${dateLabel}) — ${label} entrou como disponível na central do dia.`,
        };
      case AvailAlertType.LOT_AVAILABLE_BACK:
        return {
          title: `Voltou a disponível: ${label}`,
          body: `${devName} (${dateLabel}) — ${label} retornou para disponível (${ev.fromStatus ? statusLabel(ev.fromStatus) : '—'} → disponível).`,
        };
      case AvailAlertType.LOT_SOLD:
        return {
          title: `Vendido: ${label}`,
          body: `${devName} (${dateLabel}) — ${label} marcado como vendido na disponibilidade do dia.`,
        };
      case AvailAlertType.LOT_RESERVED:
        return {
          title: `Reservado: ${label}`,
          body: `${devName} (${dateLabel}) — ${label} reservado na central.`,
        };
      case AvailAlertType.LOT_NEGOTIATION:
        return {
          title: `Em negociação: ${label}`,
          body: `${devName} (${dateLabel}) — ${label} em negociação na disponibilidade do dia.`,
        };
      case AvailAlertType.LOT_PRICE_CHANGED:
        return {
          title: `Preço atualizado: ${label}`,
          body: `${devName} (${dateLabel}) — ${label}: preço ${ev.fromPrice != null ? `R$ ${ev.fromPrice.toLocaleString('pt-BR')}` : '—'} → ${ev.toPrice != null ? `R$ ${ev.toPrice.toLocaleString('pt-BR')}` : '—'}.`,
        };
      default:
        return {
          title: `Disponibilidade: ${label}`,
          body: `${devName} (${dateLabel}) — alteração registrada.`,
        };
    }
  }

  private async notificationExists(params: {
    userId: string;
    type: string;
    dailyAvailabilityId: string;
    lotId: string | null;
  }) {
    const row = await this.prisma.inAppNotification.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        dailyAvailabilityId: params.dailyAvailabilityId,
        lotId: params.lotId,
      },
      select: { id: true },
    });
    return !!row;
  }

  private async loadLotLabels(lotIds: string[]) {
    const lots = await this.prisma.lot.findMany({
      where: { id: { in: lotIds } },
      select: { id: true, number: true, block: { select: { name: true } } },
    });
    return new Map(lots.map((l) => [l.id, `${l.block.name} · Lote ${l.number}`]));
  }

  private async emitMatchAlerts(
    developmentId: string,
    snapshotId: string,
    events: { kind: string; lotId: string }[],
    devName: string,
  ) {
    const availLots = new Set(
      events
        .filter(
          (e) =>
            e.kind === AvailAlertType.LOT_AVAILABLE_NEW || e.kind === AvailAlertType.LOT_AVAILABLE_BACK,
        )
        .map((e) => e.lotId),
    );

    if (!availLots.size) return;

    const leads = await this.prisma.lead.findMany({
      where: {
        userId: { not: null },
        status: { notIn: [LeadStatus.PERDIDO, LeadStatus.VENDIDO] },
        OR: [
          { developmentId },
          { interestProfile: { preferredDevelopmentIds: { has: developmentId } } },
        ],
      },
      select: { id: true, userId: true, name: true, phone: true },
      take: 80,
    });

    const labels = await this.loadLotLabels([...availLots]);

    for (const lotId of availLots) {
      for (const lead of leads) {
        if (!lead.userId) continue;
        const scored = await this.matchEngine.scoreLotForLead(lead.id, lotId);
        if (!scored || scored.kind !== 'LOT' || scored.score < AVAIL_MATCH_SCORE_MIN) continue;

        const existing = await this.prisma.inAppNotification.findMany({
          where: {
            userId: lead.userId,
            type: AvailAlertType.MATCH_CLIENT,
            lotId,
            dailyAvailabilityId: snapshotId,
          },
          select: { metadataJson: true },
        });
        const already = existing.some(
          (e) => (e.metadataJson as { leadId?: string } | null)?.leadId === lead.id,
        );
        if (already) continue;

        const lotLabel = labels.get(lotId) ?? lotId;
        await this.prisma.inAppNotification.create({
          data: {
            userId: lead.userId,
            type: AvailAlertType.MATCH_CLIENT,
            title: `Match: ${lead.name} × ${lotLabel}`,
            body: `${devName || 'Loteamento'} — compatibilidade ${(scored.score * 100).toFixed(0)}%. Revise no CRM / match inteligente.`,
            developmentId,
            lotId,
            dailyAvailabilityId: snapshotId,
            metadataJson: {
              source: 'availability_match',
              leadId: lead.id,
              leadName: lead.name,
              leadPhone: lead.phone,
              lotId,
              score: scored.score,
              reasons: scored.reasons,
              snapshotId,
            } as Prisma.InputJsonValue,
          },
        });
      }
    }
  }
}
