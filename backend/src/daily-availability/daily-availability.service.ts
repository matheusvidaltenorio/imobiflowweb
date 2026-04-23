import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DailyAvailabilitySourceType,
  GestoraSubmissionStatus,
  LotDailySnapshotStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AvailabilityAlertDispatchService } from '../availability-alerts/availability-alert-dispatch.service';
import type { BulkSnapshotDto, CreateSnapshotDto, ResetDayDto } from './dto/create-snapshot.dto';

function spTodayIsoDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseDateOnly(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new BadRequestException('Data inválida');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

function countsFromSnapshots(rows: { status: LotDailySnapshotStatus }[]) {
  const c = { DISPONIVEL: 0, RESERVADO: 0, VENDIDO: 0, NEGOCIACAO: 0 };
  for (const r of rows) c[r.status]++;
  return {
    disponiveis: c.DISPONIVEL,
    reservados: c.RESERVADO,
    vendidos: c.VENDIDO,
    negociacao: c.NEGOCIACAO,
  };
}

function diffSnapshots(
  prev: { lotId: string; status: LotDailySnapshotStatus }[],
  curr: { lotId: string; status: LotDailySnapshotStatus }[],
): { lotId: string; from: LotDailySnapshotStatus | null; to: LotDailySnapshotStatus }[] {
  const mapPrev = new Map(prev.map((p) => [p.lotId, p.status]));
  const out: { lotId: string; from: LotDailySnapshotStatus | null; to: LotDailySnapshotStatus }[] = [];
  for (const row of curr) {
    const from = mapPrev.get(row.lotId) ?? null;
    if (from !== row.status) out.push({ lotId: row.lotId, from, to: row.status });
  }
  return out;
}

@Injectable()
export class DailyAvailabilityService {
  constructor(
    private prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly availabilityAlerts: AvailabilityAlertDispatchService,
  ) {}

  private async assertDevelopmentExists(developmentId: string) {
    const d = await this.prisma.development.findUnique({ where: { id: developmentId } });
    if (!d) throw new NotFoundException('Loteamento não encontrado');
    return d;
  }

  private async assertLotsBelongToDevelopment(developmentId: string, lotIds: string[]) {
    if (lotIds.length === 0) return;
    const rows = await this.prisma.lot.findMany({
      where: { id: { in: lotIds }, block: { developmentId } },
      select: { id: true },
    });
    if (rows.length !== lotIds.length) throw new BadRequestException('Um ou mais lotes não pertencem ao loteamento');
  }

  async createSnapshot(
    developmentId: string,
    userId: string,
    dto: CreateSnapshotDto,
    opts?: { gestoraSubmissionStatus?: GestoraSubmissionStatus | null },
  ) {
    await this.assertDevelopmentExists(developmentId);
    const date = parseDateOnly(dto.date);
    const snaps = dto.snapshots ?? [];
    const lotIds = [...new Set(snaps.map((s) => s.lotId))];
    await this.assertLotsBelongToDevelopment(developmentId, lotIds);

    const assistedMeta = ((): Prisma.InputJsonValue | undefined => {
      if (dto.assistedMetadata != null) {
        return {
          ...dto.assistedMetadata,
          ...(dto.assistedConfirmed
            ? { confirmedAt: new Date().toISOString(), confirmedByUserId: userId }
            : {}),
        } as Prisma.InputJsonValue;
      }
      if (dto.assistedConfirmed) {
        return {
          mode: 'ASSISTED',
          confirmedAt: new Date().toISOString(),
          confirmedByUserId: userId,
        } as Prisma.InputJsonValue;
      }
      return undefined;
    })();

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dailyAvailability.create({
        data: {
          developmentId,
          date,
          sourceType: dto.sourceType,
          sourceFileUrl: dto.sourceFileUrl ?? null,
          notes: dto.notes ?? null,
          rawText: dto.rawText ?? null,
          assistedMetadata: assistedMeta,
          importMetadata:
            dto.importMetadata != null ? (dto.importMetadata as Prisma.InputJsonValue) : undefined,
          ...(opts?.gestoraSubmissionStatus != null
            ? { gestoraSubmissionStatus: opts.gestoraSubmissionStatus }
            : {}),
          createdById: userId,
          lotSnapshots: {
            create: snaps.map((s) => ({
              lotId: s.lotId,
              status: s.status,
              price: s.price != null ? new Prisma.Decimal(s.price) : null,
              notes: s.notes ?? null,
            })),
          },
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          lotSnapshots: { include: { lot: { include: { block: true } } } },
        },
      });
      return this.attachDelta(created);
    });

    if (dto.assistedConfirmed) {
      const delta = result.summary?.changesSincePrevious ?? [];
      await this.audit.log({
        userId,
        action: 'DAILY_AVAILABILITY_ASSISTED_CONFIRMED',
        entity: 'DailyAvailability',
        entityId: result.id,
        metadata: {
          developmentId,
          date: dto.date,
          snapshotCount: snaps.length,
          changesSincePreviousCount: result.summary?.changesSincePreviousCount ?? 0,
          assisted: true,
        },
      });
      if (delta.length > 0) {
        await this.audit.log({
          userId,
          action: 'DAILY_AVAILABILITY_LOT_CHANGES',
          entity: 'DailyAvailability',
          entityId: result.id,
          metadata: {
            changes: delta.slice(0, 100).map((c) => ({
              lotId: c.lotId,
              from: c.from,
              to: c.to,
            })),
          },
        });
      }
    }

    if (!opts?.gestoraSubmissionStatus && snaps.length > 0) {
      void this.availabilityAlerts.onPublishedDailyAvailability(result.id);
    }

    return result;
  }

  async uploadImageAndCreateShell(
    developmentId: string,
    userId: string,
    body: { date: string; notes?: string; rawText?: string },
    fileUrl: string,
    opts?: { gestoraSubmissionStatus?: GestoraSubmissionStatus | null },
  ) {
    await this.assertDevelopmentExists(developmentId);
    const date = parseDateOnly(body.date);
    const created = await this.prisma.dailyAvailability.create({
      data: {
        developmentId,
        date,
        sourceType: DailyAvailabilitySourceType.IMAGE,
        sourceFileUrl: fileUrl,
        notes: body.notes ?? null,
        rawText: body.rawText ?? null,
        ...(opts?.gestoraSubmissionStatus != null
          ? { gestoraSubmissionStatus: opts.gestoraSubmissionStatus }
          : {}),
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lotSnapshots: { include: { lot: { include: { block: true } } } },
      },
    });
    return this.attachDelta(created);
  }

  async parseCsvPreview(csvText: string) {
    const lines = csvText
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const rows = lines.map((line) => line.split(/[,;\t]/).map((c) => c.trim()));
    return {
      rowCount: rows.length,
      rows: rows.slice(0, 50),
      truncated: rows.length > 50,
    };
  }

  async bulkApply(
    developmentId: string,
    userId: string,
    dto: BulkSnapshotDto,
    opts?: { gestoraSubmissionStatus?: GestoraSubmissionStatus | null },
  ) {
    await this.assertDevelopmentExists(developmentId);
    const date = parseDateOnly(dto.date);

    let lotIds: string[] = [];
    if (dto.blockId) {
      const lots = await this.prisma.lot.findMany({
        where: { blockId: dto.blockId, block: { developmentId } },
        select: { id: true },
      });
      lotIds = lots.map((l) => l.id);
      if (lotIds.length === 0) throw new BadRequestException('Quadra sem lotes ou inválida para este loteamento');
    } else if (dto.lotIds?.length) {
      lotIds = [...new Set(dto.lotIds)];
      await this.assertLotsBelongToDevelopment(developmentId, lotIds);
    } else {
      throw new BadRequestException('Informe blockId ou lotIds');
    }

    const snapshots = lotIds.map((lotId) => ({
      lotId,
      status: dto.status,
      price: undefined as number | undefined,
      notes: undefined as string | undefined,
    }));

    return this.createSnapshot(
      developmentId,
      userId,
      {
        date: dto.date,
        sourceType: dto.sourceType,
        notes: dto.notes,
        snapshots,
      },
      opts,
    );
  }

  async resetDay(
    developmentId: string,
    userId: string,
    dto: ResetDayDto,
    opts?: { gestoraSubmissionStatus?: GestoraSubmissionStatus | null },
  ) {
    await this.assertDevelopmentExists(developmentId);
    const lots = await this.prisma.lot.findMany({
      where: { block: { developmentId } },
      select: { id: true },
    });
    const snapshots = lots.map((l) => ({
      lotId: l.id,
      status: LotDailySnapshotStatus.DISPONIVEL,
    }));
    return this.createSnapshot(
      developmentId,
      userId,
      {
        date: dto.date,
        sourceType: dto.sourceType,
        notes: dto.notes,
        snapshots,
      },
      opts,
    );
  }

  private async attachDelta<
    T extends {
      developmentId: string;
      date: Date;
      createdAt: Date;
      lotSnapshots: { lotId: string; status: LotDailySnapshotStatus }[];
    },
  >(created: T) {
    const previous = await this.prisma.dailyAvailability.findFirst({
      where: {
        developmentId: created.developmentId,
        date: created.date,
        createdAt: { lt: created.createdAt },
      },
      orderBy: { createdAt: 'desc' },
      include: { lotSnapshots: true },
    });

    const currCounts = countsFromSnapshots(created.lotSnapshots);
    const prevCounts = previous ? countsFromSnapshots(previous.lotSnapshots) : null;
    const changesSincePrevious = previous
      ? diffSnapshots(
          previous.lotSnapshots.map((s) => ({ lotId: s.lotId, status: s.status })),
          created.lotSnapshots.map((s) => ({ lotId: s.lotId, status: s.status })),
        )
      : [];

    return {
      ...created,
      summary: {
        ...currCounts,
        previous: prevCounts,
        changesSincePreviousCount: changesSincePrevious.length,
        changesSincePrevious: changesSincePrevious.slice(0, 200),
      },
    };
  }

  /**
   * Último registro de disponibilidade com data estritamente anterior à referência
   * (reaproveitamento / conferência diferencial vs última operação real, não só “ontem”).
   */
  async getLatestBeforeDate(
    developmentId: string,
    beforeIso: string,
    opts?: { visibility?: 'published' | 'all' },
  ) {
    await this.assertDevelopmentExists(developmentId);
    const before = parseDateOnly(beforeIso);
    const visibility = opts?.visibility ?? 'published';
    const row = await this.prisma.dailyAvailability.findFirst({
      where: {
        developmentId,
        date: { lt: before },
        ...(visibility === 'published' ? { gestoraSubmissionStatus: null } : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lotSnapshots: { select: { lotId: true, status: true, price: true } },
      },
    });
    if (!row) {
      return { baseline: null as null };
    }
    return {
      baseline: {
        id: row.id,
        date: row.date,
        sourceType: row.sourceType,
        sourceFileUrl: row.sourceFileUrl,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        lotSnapshots: row.lotSnapshots.map((s) => ({
          lotId: s.lotId,
          status: s.status,
          price: s.price != null ? Number(s.price) : null,
        })),
      },
    };
  }

  async getCurrent(developmentId: string, dateIso?: string, opts?: { visibility?: 'published' | 'all' }) {
    await this.assertDevelopmentExists(developmentId);
    const date = dateIso ? parseDateOnly(dateIso) : parseDateOnly(spTodayIsoDate());
    const visibility = opts?.visibility ?? 'published';
    const latest = await this.prisma.dailyAvailability.findFirst({
      where: {
        developmentId,
        date,
        ...(visibility === 'published' ? { gestoraSubmissionStatus: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lotSnapshots: { include: { lot: { include: { block: { include: { development: true } } } } } },
      },
    });
    if (!latest) {
      return {
        developmentId,
        date: dateIso ?? spTodayIsoDate(),
        latest: null,
        summary: null,
      };
    }
    /** Mantém URL da imagem do dia mesmo quando o último snapshot é MANUAL sem arquivo. */
    let merged = latest;
    if (!latest.sourceFileUrl) {
      const withImage = await this.prisma.dailyAvailability.findFirst({
        where: {
          developmentId,
          date,
          sourceFileUrl: { not: null },
          ...(visibility === 'published' ? { gestoraSubmissionStatus: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: { sourceFileUrl: true },
      });
      if (withImage?.sourceFileUrl) {
        merged = { ...latest, sourceFileUrl: withImage.sourceFileUrl };
      }
    }
    return { latest: await this.attachDelta(merged) };
  }

  async getTodayBrokerView(filters: {
    developmentId?: string;
    blockId?: string;
    dateIso?: string;
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;
  }) {
    const dateIso = filters.dateIso ?? spTodayIsoDate();
    const date = parseDateOnly(dateIso);

    const whereDev: Prisma.DailyAvailabilityWhereInput = {
      date,
      gestoraSubmissionStatus: null,
    };
    if (filters.developmentId) whereDev.developmentId = filters.developmentId;

    const latestRows = await this.prisma.dailyAvailability.findMany({
      where: whereDev,
      distinct: ['developmentId'],
      orderBy: [{ developmentId: 'asc' }, { createdAt: 'desc' }],
      include: {
        development: true,
        createdBy: { select: { id: true, name: true } },
        lotSnapshots: {
          include: {
            lot: { include: { block: true } },
          },
        },
      },
    });

    const results = latestRows.map((row) => {
      let snaps = row.lotSnapshots;
      if (filters.blockId) snaps = snaps.filter((s) => s.lot.blockId === filters.blockId);

      const items = snaps
        .map((s) => {
          const priceNum = s.price != null ? Number(s.price) : s.lot.price != null ? Number(s.lot.price) : null;
          const areaNum = s.lot.area != null ? Number(s.lot.area) : null;
          return { snapshot: s, priceNum, areaNum };
        })
        .filter(({ priceNum, areaNum }) => {
          if (filters.minPrice != null && (priceNum == null || priceNum < filters.minPrice)) return false;
          if (filters.maxPrice != null && (priceNum == null || priceNum > filters.maxPrice)) return false;
          if (filters.minArea != null && (areaNum == null || areaNum < filters.minArea)) return false;
          if (filters.maxArea != null && (areaNum == null || areaNum > filters.maxArea)) return false;
          return true;
        });

      const summary = countsFromSnapshots(items.map(({ snapshot: s }) => ({ status: s.status })));

      return {
        development: row.development,
        dailyAvailability: {
          id: row.id,
          date: row.date,
          sourceType: row.sourceType,
          sourceFileUrl: row.sourceFileUrl,
          createdAt: row.createdAt,
          createdBy: row.createdBy,
        },
        summary,
        lots: items.map(({ snapshot: s, priceNum, areaNum }) => ({
          lotId: s.lotId,
          number: s.lot.number,
          blockId: s.lot.blockId,
          blockName: s.lot.block.name,
          dailyStatus: s.status,
          snapshotPrice: s.price != null ? Number(s.price) : null,
          catalogPrice: s.lot.price != null ? Number(s.lot.price) : null,
          effectivePrice: priceNum,
          areaM2: areaNum,
          notes: s.notes,
        })),
      };
    });

    return { date: dateIso, developments: results };
  }

  async getHistory(
    developmentId: string,
    limit = 40,
    dateIso?: string,
    opts?: { includePendingSubmissions?: boolean },
  ) {
    await this.assertDevelopmentExists(developmentId);
    const where: Prisma.DailyAvailabilityWhereInput = { developmentId };
    if (dateIso) where.date = parseDateOnly(dateIso);
    if (!opts?.includePendingSubmissions) {
      where.gestoraSubmissionStatus = null;
    }

    const rows = await this.prisma.dailyAvailability.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        date: true,
        sourceType: true,
        sourceFileUrl: true,
        notes: true,
        createdAt: true,
        importMetadata: true,
        gestoraSubmissionStatus: true,
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { lotSnapshots: true } },
      },
    });

    const importSummaryKeys = [
      'fileName',
      'sheetName',
      'matchedFromSheet',
      'unmatchedCount',
      'invalidCount',
      'changesCount',
      'templateName',
      'templateId',
      'rowsSkippedBlank',
    ] as const;

    return rows.map((r) => {
      let importSummary: Partial<Record<(typeof importSummaryKeys)[number], unknown>> | null = null;
      const meta = r.importMetadata;
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        const m = meta as Record<string, unknown>;
        const o: Partial<Record<(typeof importSummaryKeys)[number], unknown>> = {};
        for (const k of importSummaryKeys) {
          if (k in m) o[k] = m[k];
        }
        importSummary = Object.keys(o).length ? o : null;
      }
      return {
        id: r.id,
        date: r.date,
        sourceType: r.sourceType,
        sourceFileUrl: r.sourceFileUrl,
        notes: r.notes,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
        snapshotCount: r._count.lotSnapshots,
        gestoraSubmissionStatus: r.gestoraSubmissionStatus,
        importSummary,
      };
    });
  }

  async getLotHistory(
    developmentId: string,
    lotId: string,
    limit = 30,
    opts?: { publishedSnapshotsOnly?: boolean },
  ) {
    await this.assertLotsBelongToDevelopment(developmentId, [lotId]);
    const publishedOnly = opts?.publishedSnapshotsOnly ?? false;
    const rows = await this.prisma.lotDailyStatus.findMany({
      where: {
        lotId,
        dailyAvailability: {
          developmentId,
          ...(publishedOnly ? { gestoraSubmissionStatus: null } : {}),
        },
      },
      orderBy: { dailyAvailability: { createdAt: 'desc' } },
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        dailyAvailability: {
          select: {
            id: true,
            date: true,
            sourceType: true,
            gestoraSubmissionStatus: true,
            createdAt: true,
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      price: r.price != null ? Number(r.price) : null,
      notes: r.notes,
      dailyAvailability: r.dailyAvailability,
    }));
  }

  async getOne(id: string, viewer?: { role: UserRole }) {
    const row = await this.prisma.dailyAvailability.findUnique({
      where: { id },
      include: {
        development: true,
        createdBy: { select: { id: true, name: true, email: true } },
        lotSnapshots: { include: { lot: { include: { block: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Registro não encontrado');
    if (
      viewer?.role === UserRole.CORRETOR &&
      row.gestoraSubmissionStatus != null
    ) {
      throw new NotFoundException('Registro não encontrado');
    }
    return row;
  }

  async approveGestoraSubmission(id: string, adminUserId: string) {
    const row = await this.prisma.dailyAvailability.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Registro não encontrado');
    if (row.gestoraSubmissionStatus !== GestoraSubmissionStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Registro não está aguardando aprovação da gestora');
    }
    await this.prisma.dailyAvailability.update({
      where: { id },
      data: { gestoraSubmissionStatus: null },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'DAILY_AVAILABILITY_GESTORA_APPROVED',
      entity: 'DailyAvailability',
      entityId: id,
      metadata: { developmentId: row.developmentId, date: row.date },
    });
    void this.availabilityAlerts.onPublishedDailyAvailability(id);
    return { ok: true };
  }

  async rejectGestoraSubmission(id: string, adminUserId: string, notes?: string) {
    const row = await this.prisma.dailyAvailability.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Registro não encontrado');
    if (row.gestoraSubmissionStatus !== GestoraSubmissionStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Registro não está aguardando aprovação da gestora');
    }
    await this.prisma.dailyAvailability.update({
      where: { id },
      data: {
        gestoraSubmissionStatus: GestoraSubmissionStatus.REJECTED,
        notes: notes?.trim() ? notes.trim() : row.notes,
      },
    });
    await this.audit.log({
      userId: adminUserId,
      action: 'DAILY_AVAILABILITY_GESTORA_REJECTED',
      entity: 'DailyAvailability',
      entityId: id,
      metadata: { developmentId: row.developmentId, date: row.date },
    });
    return { ok: true };
  }
}
