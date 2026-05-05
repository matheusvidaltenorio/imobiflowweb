import { GestoraPublishMode, PrismaClient, UserRole } from '@prisma/client';
import type { HomologSeedContext } from './types';
import { HOMOLOG_SOURCE } from './types';
import { TEST_BROKER_EMAILS, TEST_CLIENT_EMAILS } from '../test-users.seed';

/**
 * Homolog: não cria novos usuários — reutiliza corretor1-5 / cliente1-5 / admin / gestoras @teste.com
 * (criados em test-users.seed). Garante carteiras Property e vínculo gestora2 em loteamento demo.
 */
export async function seedHomologUsers(prisma: PrismaClient): Promise<HomologSeedContext> {
  console.log('\n[homolog] escopo de dados (usuários já em @teste.com)…');

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@teste.com', role: UserRole.ADMIN },
    select: { id: true },
  });
  if (!admin) throw new Error('[homolog] admin@teste.com não encontrado — rode test-users no seed.');

  const gestora1 = await prisma.user.findFirst({
    where: { email: 'gestora1@teste.com', role: UserRole.GESTORA },
    select: { id: true },
  });
  const gestora2 = await prisma.user.findFirst({
    where: { email: 'gestora2@teste.com', role: UserRole.GESTORA },
    select: { id: true },
  });
  if (!gestora1 || !gestora2) throw new Error('[homolog] gestora1/2@teste.com não encontradas.');

  const brokerRows = await prisma.user.findMany({
    where: { email: { in: [...TEST_BROKER_EMAILS] }, role: UserRole.CORRETOR },
    orderBy: { email: 'asc' },
    select: { id: true, email: true, name: true },
  });
  if (brokerRows.length < 5) {
    throw new Error(`[homolog] Esperados 5 corretores @teste.com, encontrados ${brokerRows.length}.`);
  }

  const clientRows = await prisma.user.findMany({
    where: { email: { in: [...TEST_CLIENT_EMAILS] }, role: UserRole.CLIENTE },
    orderBy: { email: 'asc' },
    select: { id: true, email: true },
  });
  if (clientRows.length < 5) {
    throw new Error(`[homolog] Esperados 5 clientes @teste.com, encontrados ${clientRows.length}.`);
  }

  const brokers = brokerRows.map((b) => ({ id: b.id, email: b.email, name: b.name }));
  const clientUsers = clientRows.map((c) => ({ id: c.id, email: c.email }));

  const vista = await prisma.development.findFirst({
    where: { name: 'Residencial Vista Verde' },
    select: { id: true },
  });
  if (!vista) throw new Error('[homolog] Residencial Vista Verde não encontrado.');

  const demoDev = await prisma.development.findFirst({
    where: { slug: 'demo-ce-jua-parque' },
    select: { id: true },
  });

  for (let i = 0; i < brokers.length; i += 1) {
    const b = brokers[i]!;
    const title = `[${HOMOLOG_SOURCE}] Carteira — ${b.name}`;
    const exists = await prisma.property.findFirst({
      where: { userId: b.id, title },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.property.create({
      data: {
        userId: b.id,
        developmentId: vista.id,
        title,
        description: 'Vínculo operacional homologação (catálogo / permissões).',
        type: 'TERRENO',
        status: 'DISPONIVEL',
        price: 0,
        city: 'São Paulo',
        neighborhood: 'Homolog',
      },
    });
  }

  const accG2 =
    demoDev &&
    (await prisma.managerDevelopmentAccess.findUnique({
      where: { userId_developmentId: { userId: gestora2.id, developmentId: demoDev.id } },
    }));
  if (demoDev && !accG2) {
    await prisma.managerDevelopmentAccess.create({
      data: {
        userId: gestora2.id,
        developmentId: demoDev.id,
        spreadsheetImportEnabled: true,
        assistedImageEnabled: true,
        publishMode: GestoraPublishMode.IMMEDIATE,
      },
    });
  }

  const crmClients: HomologSeedContext['crmClients'] = [];
  for (let i = 0; i < clientUsers.length; i += 1) {
    const cu = clientUsers[i]!;
    const brokerId = brokers[i % brokers.length]!.id;
    let c = await prisma.client.findFirst({ where: { email: cu.email } });
    if (!c) {
      c = await prisma.client.create({
        data: {
          name: `Cliente ${i + 1}`,
          email: cu.email,
          phone: `1192000${String(i + 1).padStart(4, '0')}`,
          brokerId,
          notes: `Cadastro homologação (${HOMOLOG_SOURCE})`,
        },
      });
    } else if (c.brokerId !== brokerId) {
      await prisma.client.update({ where: { id: c.id }, data: { brokerId } });
    }
    crmClients.push({ id: c.id, email: c.email, brokerId });
  }

  const legacyProp = await prisma.property.findFirst({
    where: { title: 'Casa com 3 quartos - Vila Mariana' },
    select: { id: true },
  });

  const mainBroker = await prisma.user.findFirst({
    where: { email: 'corretor1@teste.com' },
    select: { id: true },
  });

  return {
    admin2Id: admin.id,
    gestoraId: gestora1.id,
    brokers,
    clientUsers,
    crmClients,
    vistaVerdeId: vista.id,
    mainBrokerId: mainBroker?.id ?? brokers[0]!.id,
    demoDevId: demoDev?.id ?? null,
    legacyShowcasePropertyId: legacyProp?.id ?? null,
  };
}
