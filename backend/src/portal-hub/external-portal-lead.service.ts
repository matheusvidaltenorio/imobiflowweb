import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ExternalLeadIngestStatus,
  LeadStatus,
  PortalCode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';

@Injectable()
export class ExternalPortalLeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
  ) {}

  /**
   * Webhook padronizado: cria lead no CRM se ainda não existir (dedupe por portal+externalLeadId).
   * Informe exatamente um escopo: propertyId, lotId ou developmentId (regra do CRM).
   */
  async ingest(dto: {
    portal: PortalCode;
    externalLeadId: string;
    listingReference?: string;
    name: string;
    email: string;
    phone?: string;
    message?: string;
    propertyId?: string;
    lotId?: string;
    developmentId?: string;
    rawPayload: unknown;
  }) {
    const dedupeKey = `${dto.portal}:${dto.externalLeadId}`;
    const existing = await this.prisma.externalPortalLead.findUnique({ where: { dedupeKey } });
    if (existing?.leadId) {
      return { status: 'deduplicated' as const, externalPortalLead: existing };
    }

    const row = await this.prisma.externalPortalLead.create({
      data: {
        portal: dto.portal,
        externalLeadId: dto.externalLeadId,
        listingReference: dto.listingReference,
        rawPayload: dto.rawPayload as object,
        dedupeKey,
        status: ExternalLeadIngestStatus.RECEIVED,
      },
    });

    try {
      const lead = await this.leads.create(
        {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          message: dto.message ?? `Lead portal ${dto.portal}`,
          propertyId: dto.propertyId,
          lotId: dto.lotId,
          developmentId: dto.developmentId,
          leadSource: 'OUTRO',
          source: `PORTAL_${dto.portal}`,
        },
        undefined,
      );

      await this.prisma.externalPortalLead.update({
        where: { id: row.id },
        data: {
          leadId: lead.id,
          status: ExternalLeadIngestStatus.CRM_LEAD_CREATED,
          processedAt: new Date(),
        },
      });

      const noteLine = `[Portal ${dto.portal}] ref ${dto.listingReference ?? dto.externalLeadId}`;
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          notes: [noteLine, lead.notes].filter(Boolean).join('\n\n'),
          status: LeadStatus.NOVO_LEAD,
        },
      });

      return { status: 'created' as const, leadId: lead.id, externalPortalLeadId: row.id };
    } catch (e) {
      await this.prisma.externalPortalLead.update({
        where: { id: row.id },
        data: {
          status: ExternalLeadIngestStatus.FAILED,
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      });
      throw e instanceof BadRequestException ? e : new BadRequestException((e as Error).message);
    }
  }
}
