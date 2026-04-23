import { Injectable } from '@nestjs/common';
import { InterestProfile, Lead, Lot, Property, PropertyStatus, PropertyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type MatchReason = { code: string; label: string; weight: number; detail?: string };

export type ScoredTarget =
  | {
      kind: 'LOT';
      lotId: string;
      score: number;
      reasons: MatchReason[];
    }
  | {
      kind: 'PROPERTY';
      propertyId: string;
      score: number;
      reasons: MatchReason[];
    };

@Injectable()
export class MatchEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async buildForLead(leadId: string): Promise<ScoredTarget[]> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { interestProfile: true },
    });
    if (!lead) return [];

    const profile = lead.interestProfile;

    const lots = await this.prisma.lot.findMany({
      where: {
        status: { in: [PropertyStatus.DISPONIVEL, PropertyStatus.EM_NEGOCIACAO] },
      },
      take: 400,
      include: { block: { include: { development: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const properties = await this.prisma.property.findMany({
      where: { status: PropertyStatus.DISPONIVEL },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    });

    const lotScores: ScoredTarget[] = [];
    for (const lot of lots) {
      lotScores.push(await this.scoreLot(profile, lead, lot));
    }

    const propScores: ScoredTarget[] = [];
    for (const p of properties) {
      propScores.push(this.scoreProperty(profile, lead, p));
    }

    return [...lotScores, ...propScores].sort((a, b) => b.score - a.score).slice(0, 40);
  }

  /** Pontua um lote específico para o lead (alertas após atualização da disponibilidade do dia). */
  async scoreLotForLead(leadId: string, lotId: string): Promise<ScoredTarget | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { interestProfile: true },
    });
    if (!lead) return null;
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { block: { include: { development: true } } },
    });
    if (!lot) return null;
    return this.scoreLot(lead.interestProfile, lead, lot);
  }

  private async scoreLot(
    profile: InterestProfile | null,
    lead: Lead,
    lot: Lot & { block: { developmentId: string; name: string; development: { id: string; name: string; city: string } } },
  ): Promise<ScoredTarget> {
    const reasons: MatchReason[] = [];
    let score = 0.35;

    const price = lot.price != null ? Number(lot.price) : null;
    const area = lot.area != null ? Number(lot.area) : null;
    const devId = lot.block.developmentId;

    if (lead.developmentId && lead.developmentId === devId) {
      score += 0.2;
      reasons.push({ code: 'LEAD_DEV', label: 'Lead já vinculado ao loteamento', weight: 0.2, detail: lot.block.development.name });
    }

    if (profile?.preferredDevelopmentIds?.includes(devId)) {
      score += 0.15;
      reasons.push({ code: 'PREF_DEV', label: 'Loteamento nas preferências', weight: 0.15 });
    }

    if (profile?.budgetMax != null && price != null) {
      const max = Number(profile.budgetMax);
      if (price <= max) {
        const ratio = 1 - Math.min(1, price / max);
        const w = 0.12 * (0.5 + ratio / 2);
        score += w;
        reasons.push({ code: 'PRICE_OK', label: 'Preço dentro do orçamento', weight: w, detail: `R$ ${price.toFixed(0)} ≤ máx ${max.toFixed(0)}` });
      } else {
        score -= 0.08;
        reasons.push({ code: 'PRICE_HIGH', label: 'Preço acima do máximo declarado', weight: -0.08 });
      }
    }

    if (profile?.budgetMin != null && price != null) {
      const min = Number(profile.budgetMin);
      if (price >= min) {
        score += 0.04;
        reasons.push({ code: 'PRICE_FLOOR', label: 'Acima do piso declarado', weight: 0.04 });
      }
    }

    if (profile?.minArea != null && area != null) {
      const minA = Number(profile.minArea);
      if (area >= minA) {
        score += 0.08;
        reasons.push({ code: 'AREA_OK', label: 'Metragem compatível', weight: 0.08 });
      } else {
        score -= 0.05;
        reasons.push({ code: 'AREA_SMALL', label: 'Área abaixo do mínimo', weight: -0.05 });
      }
    }

    if (profile?.maxArea != null && area != null) {
      const maxA = Number(profile.maxArea);
      if (area <= maxA) score += 0.03;
    }

    const snap = await this.prisma.lotDailyStatus.findFirst({
      where: {
        lotId: lot.id,
        dailyAvailability: { developmentId: devId },
      },
      orderBy: { dailyAvailability: { createdAt: 'desc' } },
      include: { dailyAvailability: true },
    });
    if (snap?.status === 'DISPONIVEL') {
      score += 0.08;
      reasons.push({ code: 'DAILY_STOCK', label: 'Disponível na central do dia', weight: 0.08 });
    }

    score = Math.max(0, Math.min(1, score));
    return { kind: 'LOT', lotId: lot.id, score, reasons };
  }

  private scoreProperty(profile: InterestProfile | null, lead: Lead, p: Property): ScoredTarget {
    const reasons: MatchReason[] = [];
    let score = 0.32;

    const price = Number(p.price);
    if (lead.propertyId && lead.propertyId === p.id) {
      score += 0.25;
      reasons.push({ code: 'LEAD_PROPERTY', label: 'Imóvel já vinculado ao lead', weight: 0.25 });
    }

    if (profile?.budgetMax != null && price <= Number(profile.budgetMax)) {
      score += 0.12;
      reasons.push({ code: 'PRICE_OK', label: 'Preço compatível', weight: 0.12 });
    }

    if (profile?.preferredRegions?.length) {
      const cityHit = profile.preferredRegions.some(
        (r) => r && p.city.toLowerCase().includes(r.toLowerCase()),
      );
      if (cityHit) {
        score += 0.1;
        reasons.push({ code: 'REGION', label: 'Região/cidade alinhada', weight: 0.1 });
      }
    }

    if (p.type === PropertyType.TERRENO && profile?.propertyIntent) {
      score += 0.03;
      reasons.push({ code: 'TYPE', label: 'Tipo de imóvel considerado', weight: 0.03 });
    }

    const area = p.area != null ? Number(p.area) : null;
    if (profile?.minArea != null && area != null && area >= Number(profile.minArea)) {
      score += 0.06;
      reasons.push({ code: 'AREA', label: 'Metragem compatível', weight: 0.06 });
    }

    score = Math.max(0, Math.min(1, score));
    return { kind: 'PROPERTY', propertyId: p.id, score, reasons };
  }
}
