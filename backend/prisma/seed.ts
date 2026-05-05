import { PrismaClient } from '@prisma/client';
import {
  backfillDevelopmentSlugs,
  seedDevelopmentsCatalog,
} from './seeds/run-developments-catalog';
import { seedDevelopmentsLocations } from './seeds/developments-locations.seed';
import { seedDemoUniverse } from './seeds/demo-universe.seed';
import { seedHomologUniverse } from './seeds/homolog';
import { upsertTestUsers } from './seeds/test-users.seed';

const prisma = new PrismaClient();

async function main() {
  let development = await prisma.development.findFirst({ where: { name: 'Residencial Vista Verde' } });
  if (!development) {
    development = await prisma.development.create({
      data: {
        name: 'Residencial Vista Verde',
        slug: 'residencial-vista-verde',
        description: 'Loteamento premium com área de lazer',
        city: 'São Paulo',
        state: 'SP',
        neighborhood: 'Vila Mariana',
      },
    });
  }

  await upsertTestUsers(prisma);

  const brokerShowcase = await prisma.user.findFirst({
    where: { email: 'corretor1@teste.com', role: 'CORRETOR' },
  });
  if (!brokerShowcase) {
    throw new Error('Seed: corretor1@teste.com não encontrado após upsertTestUsers.');
  }

  await seedDevelopmentsCatalog(prisma);
  await backfillDevelopmentSlugs(prisma);
  await seedDevelopmentsLocations(prisma);
  await seedDemoUniverse(prisma);
  await seedHomologUniverse(prisma);

  let block = await prisma.block.findFirst({
    where: { developmentId: development.id, name: 'Quadra A' },
  });
  if (!block) {
    block = await prisma.block.create({
      data: { name: 'Quadra A', developmentId: development.id },
    });
  }

  const existingLot = await prisma.lot.findFirst({
    where: { blockId: block.id, number: '101' },
  });
  if (!existingLot) {
    await prisma.lot.create({
      data: {
        blockId: block.id,
        number: '101',
        area: 300,
        price: 150000,
        status: 'DISPONIVEL',
      },
    });
  }

  const bankSeeds = [
    { name: 'Caixa', monthlyRate: 0.007 },
    { name: 'Banco do Brasil', monthlyRate: 0.008 },
    { name: 'Itaú', monthlyRate: 0.009 },
    { name: 'Bradesco', monthlyRate: 0.0095 },
    { name: 'Santander', monthlyRate: 0.01 },
  ];
  for (const b of bankSeeds) {
    const existing = await prisma.bank.findFirst({ where: { name: b.name } });
    if (existing) {
      await prisma.bank.update({
        where: { id: existing.id },
        data: { monthlyRate: b.monthlyRate },
      });
    } else {
      await prisma.bank.create({ data: { name: b.name, monthlyRate: b.monthlyRate } });
    }
  }

  const showcaseTitle = 'Casa com 3 quartos - Vila Mariana';
  const showcase = await prisma.property.findFirst({
    where: { userId: brokerShowcase.id, title: showcaseTitle },
  });
  if (!showcase) {
    await prisma.property.create({
      data: {
        title: showcaseTitle,
        description: 'Linda casa em bairro nobre, 3 quartos, 2 banheiros, área de lazer.',
        type: 'CASA',
        status: 'DISPONIVEL',
        price: 850000,
        area: 150,
        bedrooms: 3,
        bathrooms: 2,
        garageSpaces: 2,
        city: 'São Paulo',
        neighborhood: 'Vila Mariana',
        street: 'Rua Domingos de Morais',
        number: '1000',
        zipCode: '04010-100',
        userId: brokerShowcase.id,
        developmentId: development.id,
      },
    });
  }

  console.log('Seed executado com sucesso.');
  console.log('Logins de teste (dev): ver comentário em prisma/seeds/test-users.seed.ts — senha única 123456.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
