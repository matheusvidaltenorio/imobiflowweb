import { LeadStatus, PrismaClient, VisitStatus } from '@prisma/client';
import type { HomologSeedContext } from './types';
import { HOMOLOG_SOURCE } from './types';

const LEAD_CYCLE: LeadStatus[] = [
  'NOVO_LEAD',
  'EM_ATENDIMENTO',
  'VISITA_AGENDADA',
  'PROPOSTA_ENVIADA',
  'RESERVADO',
  'VENDIDO',
  'PERDIDO',
];

export async function seedHomologCrm(prisma: PrismaClient, ctx: HomologSeedContext): Promise<void> {
  console.log('[homolog] CRM — leads, visitas, favoritos, perfis de interesse…');

  const lots = await prisma.lot.findMany({
    where: { block: { developmentId: ctx.vistaVerdeId } },
    take: 25,
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  const lotIds = lots.map((l) => l.id);
  const prefDevIds = [ctx.vistaVerdeId, ...(ctx.demoDevId ? [ctx.demoDevId] : [])];

  const nLeads = 18;
  const leadIds: string[] = [];

  for (let i = 0; i < nLeads; i += 1) {
    const email = `homolog.lead.${String(i + 1).padStart(2, '0')}@imobiflow.local`;
    const existing = await prisma.lead.findFirst({ where: { source: HOMOLOG_SOURCE, email } });
    if (existing) {
      leadIds.push(existing.id);
      continue;
    }
    const broker = ctx.brokers[i % ctx.brokers.length]!;
    const client = ctx.crmClients[i % ctx.crmClients.length]!;
    const st = LEAD_CYCLE[i % LEAD_CYCLE.length]!;
    const lotPick = lotIds.length ? lotIds[i % lotIds.length]! : null;
    const row = await prisma.lead.create({
      data: {
        name: `Lead Homolog ${i + 1}`,
        email,
        phone: `1193003${String(i + 1).padStart(4, '0')}`,
        source: HOMOLOG_SOURCE,
        leadSource: i % 3 === 0 ? 'WHATSAPP' : i % 3 === 1 ? 'SITE' : 'INDICACAO',
        status: st,
        isHot: st === 'PROPOSTA_ENVIADA' || st === 'RESERVADO',
        userId: broker.id,
        clientId: client.id,
        ...(lotPick ? { lotId: lotPick } : {}),
        developmentId: ctx.vistaVerdeId,
        message: 'Interesse em lote / homologação.',
        notes: `Pipeline homologação (${HOMOLOG_SOURCE})`,
        interactionCount: Math.min(i, 8),
      },
    });
    leadIds.push(row.id);
  }

  /** Perfis de interesse (match / CRM). */
  for (let i = 0; i < Math.min(12, leadIds.length); i += 1) {
    const leadId = leadIds[i]!;
    const exists = await prisma.interestProfile.findUnique({ where: { leadId } });
    if (exists) continue;
    await prisma.interestProfile.create({
      data: {
        leadId,
        budgetMin: 80000,
        budgetMax: 220000 + i * 5000,
        preferredDevelopmentIds: prefDevIds,
        preferredRegions: ['Juazeiro', 'São Paulo'],
        minArea: 200,
        maxArea: 400,
        urgencyLevel: i % 2 === 0 ? 'media' : 'alta',
      },
    });
  }

  /** Interações em leads. */
  for (let i = 0; i < Math.min(10, leadIds.length); i += 1) {
    const leadId = leadIds[i]!;
    const broker = ctx.brokers[i % ctx.brokers.length]!;
    const exists = await prisma.leadInteraction.findFirst({
      where: { leadId, type: `${HOMOLOG_SOURCE}_note` },
    });
    if (exists) continue;
    await prisma.leadInteraction.create({
      data: {
        leadId,
        userId: broker.id,
        type: `${HOMOLOG_SOURCE}_note`,
        body: `Nota homologação ${i + 1} — retorno comercial simulado.`,
      },
    });
  }

  /** Visitas: passadas, futuras, realizadas, canceladas. */
  const visitSpecs: Array<{ status: VisitStatus; dayOffset: number }> = [
    { status: VisitStatus.REALIZADA, dayOffset: -5 },
    { status: VisitStatus.REALIZADA, dayOffset: -12 },
    { status: VisitStatus.AGENDADA, dayOffset: 2 },
    { status: VisitStatus.AGENDADA, dayOffset: 9 },
    { status: VisitStatus.CANCELADA, dayOffset: -1 },
    { status: VisitStatus.REMARCADA, dayOffset: 4 },
    { status: VisitStatus.AGENDADA, dayOffset: 14 },
    { status: VisitStatus.REALIZADA, dayOffset: -20 },
  ];

  for (let i = 0; i < visitSpecs.length; i += 1) {
    const spec = visitSpecs[i]!;
    const leadId = leadIds[i % leadIds.length]!;
    const lotPick = lotIds.length ? lotIds[i % lotIds.length]! : null;
    const client = ctx.crmClients[i % ctx.crmClients.length]!;
    const broker = ctx.brokers[i % ctx.brokers.length]!;
    const marker = `VISIT_${HOMOLOG_SOURCE}_${i}`;
    const exists = await prisma.visit.findFirst({ where: { notes: marker } });
    if (exists) continue;
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + spec.dayOffset);
    await prisma.visit.create({
      data: {
        userId: broker.id,
        clientId: client.id,
        leadId,
        ...(lotPick ? { lotId: lotPick } : {}),
        scheduledAt,
        status: spec.status,
        notes: marker,
      },
    });
  }

  /** Favoritos (User CLIENTE × Property). */
  if (ctx.legacyShowcasePropertyId) {
    for (let i = 0; i < Math.min(8, ctx.clientUsers.length); i += 1) {
      const u = ctx.clientUsers[i]!;
      await prisma.favorite.upsert({
        where: {
          userId_propertyId: { userId: u.id, propertyId: ctx.legacyShowcasePropertyId },
        },
        update: {},
        create: { userId: u.id, propertyId: ctx.legacyShowcasePropertyId },
      });
    }
  }

  /** PropertyImage em um imóvel homolog (galeria não vazia). */
  const sampleProp = await prisma.property.findFirst({
    where: { userId: ctx.brokers[0]!.id, title: { contains: HOMOLOG_SOURCE } },
    select: { id: true },
  });
  if (sampleProp) {
    const hasImg = await prisma.propertyImage.findFirst({
      where: { propertyId: sampleProp.id, url: { contains: 'picsum.photos/seed/homolog-prop' } },
    });
    if (!hasImg) {
      await prisma.propertyImage.create({
        data: {
          propertyId: sampleProp.id,
          url: 'https://picsum.photos/seed/homolog-prop/1200/800',
          publicId: null,
          order: 0,
        },
      });
    }
  }
}
