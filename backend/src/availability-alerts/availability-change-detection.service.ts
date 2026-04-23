import { Injectable } from '@nestjs/common';
import { LotDailySnapshotStatus } from '@prisma/client';
import { AvailAlertType, type AvailAlertTypeValue } from './availability-alert.constants';

export type LotSnapRow = {
  lotId: string;
  status: LotDailySnapshotStatus;
  price: number | null;
};

export type DetectedAvailEvent = {
  kind: AvailAlertTypeValue;
  lotId: string;
  fromStatus: LotDailySnapshotStatus | null;
  toStatus: LotDailySnapshotStatus;
  fromPrice: number | null;
  toPrice: number | null;
  priority: number;
};

function normPrice(p: unknown): number | null {
  if (p == null) return null;
  const n = typeof p === 'number' ? p : Number(p);
  return Number.isFinite(n) ? n : null;
}

function pricesDiffer(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return Math.abs(a - b) > 0.009;
}

@Injectable()
export class AvailabilityChangeDetectionService {
  /**
   * Compara snapshots completos do mesmo dia (último vs novo) e classifica eventos comerciais.
   */
  detect(prev: LotSnapRow[], curr: LotSnapRow[]): DetectedAvailEvent[] {
    const prevMap = new Map(prev.map((r) => [r.lotId, r]));
    const out: DetectedAvailEvent[] = [];

    for (const row of curr) {
      const p = prevMap.get(row.lotId);
      const fromStatus = p?.status ?? null;
      const toStatus = row.status;
      const fromPrice = p ? normPrice(p.price) : null;
      const toPrice = normPrice(row.price);

      if (fromStatus !== toStatus) {
        const ev = this.classifyStatusChange(row.lotId, fromStatus, toStatus, fromPrice, toPrice);
        if (ev) out.push(ev);
        continue;
      }

      if (pricesDiffer(fromPrice, toPrice)) {
        out.push({
          kind: AvailAlertType.LOT_PRICE_CHANGED,
          lotId: row.lotId,
          fromStatus,
          toStatus,
          fromPrice,
          toPrice,
          priority: 50,
        });
      }
    }

    out.sort((a, b) => b.priority - a.priority);
    return out;
  }

  private classifyStatusChange(
    lotId: string,
    from: LotDailySnapshotStatus | null,
    to: LotDailySnapshotStatus,
    fromPrice: number | null,
    toPrice: number | null,
  ): DetectedAvailEvent | null {
    if (to === LotDailySnapshotStatus.DISPONIVEL) {
      if (from === null) {
        return {
          kind: AvailAlertType.LOT_AVAILABLE_NEW,
          lotId,
          fromStatus: from,
          toStatus: to,
          fromPrice,
          toPrice,
          priority: 65,
        };
      }
      if (from !== LotDailySnapshotStatus.DISPONIVEL) {
        return {
          kind: AvailAlertType.LOT_AVAILABLE_BACK,
          lotId,
          fromStatus: from,
          toStatus: to,
          fromPrice,
          toPrice,
          priority: 72,
        };
      }
      return null;
    }

    if (to === LotDailySnapshotStatus.VENDIDO) {
      return {
        kind: AvailAlertType.LOT_SOLD,
        lotId,
        fromStatus: from,
        toStatus: to,
        fromPrice,
        toPrice,
        priority: 100,
      };
    }

    if (to === LotDailySnapshotStatus.RESERVADO) {
      return {
        kind: AvailAlertType.LOT_RESERVED,
        lotId,
        fromStatus: from,
        toStatus: to,
        fromPrice,
        toPrice,
        priority: 90,
      };
    }

    if (to === LotDailySnapshotStatus.NEGOCIACAO) {
      return {
        kind: AvailAlertType.LOT_NEGOTIATION,
        lotId,
        fromStatus: from,
        toStatus: to,
        fromPrice,
        toPrice,
        priority: 85,
      };
    }

    return null;
  }
}
