import { Prisma, PrismaClient, PropertyStatus, VisitStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const DEMO_SOURCE = 'demo_seed_v1';
const DEMO_RADIUS = 3000;
const DEMO_MODE = 'driving';

type LatLng = { lat: number; lng: number };

function squareAround(c: LatLng, d = 0.0022): LatLng[] {
  return [
    { lat: c.lat - d, lng: c.lng - d },
    { lat: c.lat + d, lng: c.lng - d },
    { lat: c.lat + d, lng: c.lng + d },
    { lat: c.lat - d, lng: c.lng + d },
  ];
}

const DEMO_DEVELOPMENTS: Array<{
  slug: string;
  name: string;
  center: LatLng;
  city: string;
  street: string;
  streetNumber: string;
  neighborhood: string;
  zipCode: string;
  description: string;
}> = [
  {
    slug: 'demo-ce-jua-parque',
    name: 'Parque Residencial Demo — Juazeiro',
    center: { lat: -7.214, lng: -39.318 },
    city: 'Juazeiro do Norte',
    street: 'Avenida Padre Cícero',
    streetNumber: '2550',
    neighborhood: 'Salesianos',
    zipCode: '63041-010',
    description: 'Loteamento demo com infraestrutura planejada (dados fictícios para demonstração).',
  },
  {
    slug: 'demo-ce-barbalha-vale',
    name: 'Vale dos Ipês Demo — Barbalha',
    center: { lat: -7.301, lng: -39.295 },
    city: 'Barbalha',
    street: 'Rua Aderson Sabino',
    streetNumber: '120',
    neighborhood: 'Alto da Alegria',
    zipCode: '63180-000',
    description: 'Empreendimento demo próximo à rodovia (simulação).',
  },
  {
    slug: 'demo-ce-crato-luz',
    name: 'Residencial Luz do Cariri Demo',
    center: { lat: -7.236, lng: -39.408 },
    city: 'Crato',
    street: 'Rua Inácio Ferreira Teles',
    streetNumber: '321',
    neighborhood: 'Barro Branco',
    zipCode: '63100-000',
    description: 'Conjunto demo para vitrine comercial.',
  },
  {
    slug: 'demo-ce-missao-aero',
    name: 'Conquista Aeroporto Demo',
    center: { lat: -7.248, lng: -39.145 },
    city: 'Missão Velha',
    street: 'Rua Gessi Maciel Lopes',
    streetNumber: '314',
    neighborhood: 'Aeroporto',
    zipCode: '63218-000',
    description: 'Loteamento demo com foco em investimento.',
  },
  {
    slug: 'demo-ce-jua-universitario',
    name: 'Campus Living Demo — Juazeiro',
    center: { lat: -7.228, lng: -39.305 },
    city: 'Juazeiro do Norte',
    street: 'Avenida Maria Letícia Pereira',
    streetNumber: '1800',
    neighborhood: 'Cidade Universitária',
    zipCode: '63048-000',
    description: 'Empreendimento demo próximo à universidade (fictício).',
  },
];

function poisForDev(slug: string, c: LatLng) {
  const off = (dlat: number, dlng: number) => ({ lat: c.lat + dlat, lng: c.lng + dlng });
  /** Dados fictícios persistentes (não chamam Overpass no seed). Simulam tempos de rota / distância. */
  return [
    {
      sourceOsmId: `${slug}-seed-super`,
      name: `Supermercado Modelo (${slug.slice(-4)})`,
      category: 'supermarket',
      subcategory: 'supermarket',
      pos: off(0.004, 0.002),
      minutes: 8,
      meters: 2100,
    },
    {
      sourceOsmId: `${slug}-seed-farm`,
      name: 'Farmácia Popular Demo',
      category: 'pharmacy',
      subcategory: 'pharmacy',
      pos: off(-0.002, 0.003),
      minutes: 5,
      meters: 1200,
    },
    {
      sourceOsmId: `${slug}-seed-lanche`,
      name: 'Lanchonete Sabor do Cariri',
      category: 'fast_food',
      subcategory: 'fast_food',
      pos: off(0.0025, -0.002),
      minutes: 7,
      meters: 1600,
    },
    {
      sourceOsmId: `${slug}-seed-rest`,
      name: 'Restaurante Sabor Regional Demo',
      category: 'restaurant',
      subcategory: 'restaurant',
      pos: off(-0.003, 0.004),
      minutes: 9,
      meters: 1900,
    },
    {
      sourceOsmId: `${slug}-seed-escola`,
      name: 'Escola Municipal Demo',
      category: 'school',
      subcategory: 'school',
      pos: off(-0.004, -0.001),
      minutes: 10,
      meters: 2800,
    },
    {
      sourceOsmId: `${slug}-seed-posto`,
      name: 'Posto BR Energia Demo',
      category: 'fuel',
      subcategory: 'fuel',
      pos: off(0.001, 0.0045),
      minutes: 6,
      meters: 1400,
    },
    {
      sourceOsmId: `${slug}-seed-hosp`,
      name: 'Hospital / UPA Demo',
      category: 'hospital',
      subcategory: 'hospital',
      pos: off(0.005, -0.003),
      minutes: 12,
      meters: 3200,
    },
    {
      sourceOsmId: `${slug}-seed-bank`,
      name: 'Agência Bancária Demo',
      category: 'bank',
      subcategory: 'bank',
      pos: off(-0.0015, -0.0035),
      minutes: 4,
      meters: 950,
    },
    {
      sourceOsmId: `${slug}-seed-gym`,
      name: 'Academia Fit Demo',
      category: 'gym',
      subcategory: 'gym',
      pos: off(0.003, 0.001),
      minutes: 5,
      meters: 1100,
    },
    {
      sourceOsmId: `${slug}-seed-cafe`,
      name: 'Café da Esquina Demo',
      category: 'cafe',
      subcategory: 'cafe',
      pos: off(-0.0025, -0.0025),
      minutes: 4,
      meters: 800,
    },
  ];
}

const LOT_STATUSES: PropertyStatus[] = [
  'DISPONIVEL',
  'RESERVADO',
  'VENDIDO',
  'DISPONIVEL',
  'INDISPONIVEL',
];

export async function seedDemoUniverse(prisma: PrismaClient): Promise<void> {
  console.log('\n[demo] universo de exemplo (idempotente)…');

  const demoHash = await bcrypt.hash('demo123', 10);
  const demoBrokers: { id: string; email: string; name: string }[] = [];

  for (let i = 1; i <= 5; i += 1) {
    const email = `demo.corretor.${i}@imobiflow.local`;
    const u = await prisma.user.upsert({
      where: { email },
      update: { password: demoHash, name: `Corretor Demo ${i}`, role: 'CORRETOR', isActive: true },
      create: {
        email,
        password: demoHash,
        name: `Corretor Demo ${i}`,
        role: 'CORRETOR',
        phone: `8899999${1000 + i}`,
      },
    });
    demoBrokers.push({ id: u.id, email, name: u.name });
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const mainBroker = await prisma.user.findFirst({
    where: { email: { in: ['corretor@imobflow.com', 'corretor@imobiflow.com'] } },
  });
  const brokerForClients = mainBroker ?? demoBrokers[0]!;

  const devIds: string[] = [];

  for (const spec of DEMO_DEVELOPMENTS) {
    const polygon = squareAround(spec.center);
    let dev = await prisma.development.findUnique({ where: { slug: spec.slug } });
    if (!dev) {
      dev = await prisma.development.create({
        data: {
          name: spec.name,
          slug: spec.slug,
          description: spec.description,
          address: `${spec.street}, ${spec.streetNumber}`,
          street: spec.street,
          streetNumber: spec.streetNumber,
          city: spec.city,
          state: 'CE',
          neighborhood: spec.neighborhood,
          zipCode: spec.zipCode,
          referenceAddress: `${spec.street}, ${spec.streetNumber} — ${spec.neighborhood}`,
          locationPrecision: 'EXATA',
          locationNotes: 'Coordenadas e polígono de demonstração; ajuste no cadastro real.',
          placeName: spec.name,
          geocodingStatus: 'VERIFIED',
          geocodingConfidence: 0.92,
          polygonSource: 'demo_seed',
          locationVerifiedAt: new Date(),
          latitude: spec.center.lat,
          longitude: spec.center.lng,
          polygonCoordinates: polygon,
        },
      });
    } else {
      const patch: Prisma.DevelopmentUpdateInput = {};
      if (dev.latitude == null) patch.latitude = spec.center.lat;
      if (dev.longitude == null) patch.longitude = spec.center.lng;
      if (dev.polygonCoordinates == null) patch.polygonCoordinates = polygon;
      if (dev.geocodingStatus === 'PENDING') {
        patch.geocodingStatus = 'VERIFIED';
        patch.geocodingConfidence = 0.92;
        patch.locationVerifiedAt = new Date();
      }
      if (dev.polygonSource == null) patch.polygonSource = 'demo_seed';
      if (dev.placeName == null) patch.placeName = spec.name;
      if (Object.keys(patch).length) {
        await prisma.development.update({ where: { id: dev.id }, data: patch });
      }
    }
    devIds.push(dev.id);

    let block = await prisma.block.findFirst({
      where: { developmentId: dev.id, name: 'Quadra Demo A' },
    });
    if (!block) {
      block = await prisma.block.create({
        data: { name: 'Quadra Demo A', developmentId: dev.id },
      });
    }

    for (let n = 0; n < 5; n += 1) {
      const num = String(n + 1).padStart(2, '0');
      const exists = await prisma.lot.findFirst({
        where: { blockId: block.id, number: `D${num}` },
      });
      if (exists) continue;
      const lc = offLot(spec.center, n);
      await prisma.lot.create({
        data: {
          blockId: block.id,
          number: `D${num}`,
          area: 250 + n * 12,
          price: 120000 + n * 15000,
          status: LOT_STATUSES[n] ?? 'DISPONIVEL',
          latitude: lc.lat,
          longitude: lc.lng,
          geoStatus: 'APROXIMADO',
          mapLabel: `Lote demo ${num}`,
        },
      });
    }

    await prisma.developmentNearbyPlace.deleteMany({
      where: { developmentId: dev.id, source: 'seed' },
    });
    const now = new Date();
    const pois = poisForDev(spec.slug, spec.center);
    await prisma.developmentNearbyPlace.createMany({
      data: pois.map((p) => ({
        developmentId: dev.id,
        name: p.name,
        category: p.category,
        subcategory: p.subcategory,
        latitude: p.pos.lat,
        longitude: p.pos.lng,
        shortAddress: `${spec.city}, CE`,
        source: 'seed',
        sourceOsmId: p.sourceOsmId,
        searchRadiusMeters: DEMO_RADIUS,
        distanceMeters: p.meters,
        travelTimeMinutes: p.minutes,
        travelMode: DEMO_MODE,
        routeSource: 'demo_static',
        fetchedAt: now,
        updatedAt: now,
      })),
    });
  }

  /** Permite ao corretor principal usar campanhas/ranking nos loteamentos demo (Property + developmentId). */
  if (mainBroker) {
    for (const devId of devIds) {
      const dev = await prisma.development.findUnique({
        where: { id: devId },
        select: { id: true, name: true, city: true },
      });
      if (!dev) continue;
      const exists = await prisma.property.findFirst({
        where: { userId: mainBroker.id, developmentId: devId },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.property.create({
        data: {
          userId: mainBroker.id,
          developmentId: devId,
          title: `Catálogo — ${dev.name}`,
          description: 'Vínculo ao catálogo para permissões de corretor (demo).',
          type: 'TERRENO',
          status: 'DISPONIVEL',
          price: new Prisma.Decimal(0),
          city: dev.city,
          neighborhood: '—',
        },
      });
    }
  }

  const clientRows: { id: string }[] = [];
  const firstNames = ['Mariana', 'Carlos', 'Fernanda', 'Ricardo', 'Juliana'];
  const lastNames = ['Alves', 'Monteiro', 'Santos', 'Lima', 'Costa'];
  for (let i = 0; i < 5; i += 1) {
    const email = `demo.cliente.${i + 1}@example.test`;
    let c = await prisma.client.findFirst({ where: { email } });
    if (!c) {
      c = await prisma.client.create({
        data: {
          name: `${firstNames[i]} ${lastNames[i]}`,
          email,
          phone: `8898888${7000 + i}`,
          brokerId: brokerForClients.id,
          notes: `Cliente fictício (${DEMO_SOURCE})`,
        },
      });
    }
    clientRows.push({ id: c.id });
  }

  const lots = await prisma.lot.findMany({
    where: { block: { developmentId: { in: devIds } }, number: { startsWith: 'D' } },
    orderBy: { id: 'asc' },
    take: 5,
  });

  for (let i = 0; i < 5; i += 1) {
    const exists = await prisma.lead.findFirst({
      where: { source: DEMO_SOURCE, email: `demo.lead.${i + 1}@example.test` },
    });
    if (exists) continue;
    await prisma.lead.create({
      data: {
        name: `Lead Demo ${i + 1}`,
        email: `demo.lead.${i + 1}@example.test`,
        phone: `8897777${6000 + i}`,
        source: DEMO_SOURCE,
        status:
          i === 0
            ? 'NOVO_LEAD'
            : i === 1
              ? 'EM_ATENDIMENTO'
              : i === 2
                ? 'PROPOSTA_ENVIADA'
                : i === 3
                  ? 'VENDIDO'
                  : 'PERDIDO',
        isHot: i === 2 || i === 3,
        clientId: clientRows[i]!.id,
        lotId: lots[i]?.id,
        userId: demoBrokers[i % demoBrokers.length]!.id,
        message: 'Interesse em lote para moradia.',
        notes: `Lead de demonstração ${DEMO_SOURCE}`,
      },
    });
  }

  const leads = await prisma.lead.findMany({
    where: { source: DEMO_SOURCE },
    take: 5,
    orderBy: { createdAt: 'asc' },
  });

  for (let i = 0; i < 5; i += 1) {
    const lead = leads[i];
    const lot = lots[i];
    if (!lead || !lot) continue;
    const visitMarker = `VISITA_${DEMO_SOURCE}_${i}`;
    const exists = await prisma.visit.findFirst({ where: { notes: visitMarker } });
    if (exists) continue;
    await prisma.visit.create({
      data: {
        userId: demoBrokers[i % demoBrokers.length]!.id,
        clientId: clientRows[i]!.id,
        leadId: lead.id,
        lotId: lot.id,
        scheduledAt: new Date(Date.now() + (i + 1) * 86400000),
        status: i === 0 ? VisitStatus.AGENDADA : i === 1 ? VisitStatus.REALIZADA : VisitStatus.AGENDADA,
        notes: visitMarker,
      },
    });
  }

  for (let i = 0; i < 5; i += 1) {
    const lead = leads[i];
    if (!lead) continue;
    const exists = await prisma.leadInteraction.findFirst({
      where: { leadId: lead.id, type: 'demo_note' },
    });
    if (exists) continue;
    await prisma.leadInteraction.create({
      data: {
        leadId: lead.id,
        userId: demoBrokers[i % demoBrokers.length]!.id,
        type: 'demo_note',
        body: `Interação de demonstração ${i + 1} — follow-up sugerido.`,
      },
    });
  }

  if (admin) {
    for (let i = 0; i < 5; i += 1) {
      const lot = lots[i];
      const devId = devIds[i % devIds.length]!;
      if (!lot) continue;
      const exists = await prisma.instagramAdSuggestion.findFirst({
        where: { userId: admin.id, lotId: lot.id, strategicNote: { contains: DEMO_SOURCE } },
      });
      if (exists) continue;
      await prisma.instagramAdSuggestion.create({
        data: {
          userId: admin.id,
          lotId: lot.id,
          developmentId: devId,
          contentType: 'FEED',
          objective: 'LOCALIZACAO',
          toneRequested: 'CONSULTIVO',
          strategicNote: `Sugestão demo ${DEMO_SOURCE} para divulgação do lote.`,
          payloadJson: { demo: true, headline: 'Lote no Cariri', cta: 'Agende visita' },
        },
      });
    }
  }

  console.log('[demo] corretores demo: 5 | loteamentos demo: 5 | POIs seed: 10 por loteamento (cache no banco)');
  console.log('[demo] clientes, leads, visitas, interações e anúncios Instagram (quando aplicável)');
}

function offLot(c: LatLng, i: number): LatLng {
  const step = 0.00035;
  return { lat: c.lat + step * (i - 2), lng: c.lng + step * (i % 3) };
}
