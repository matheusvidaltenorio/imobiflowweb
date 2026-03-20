import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const brokerHash = await bcrypt.hash('corretor123', 10);
  const clientHash = await bcrypt.hash('cliente123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@imobflow.com' },
    update: {},
    create: {
      email: 'admin@imobflow.com',
      password: adminHash,
      name: 'Administrador',
      role: 'ADMIN',
    },
  });

  const broker = await prisma.user.upsert({
    where: { email: 'corretor@imobflow.com' },
    update: {},
    create: {
      email: 'corretor@imobflow.com',
      password: brokerHash,
      name: 'João Corretor',
      phone: '11999999999',
      role: 'CORRETOR',
    },
  });

  const client = await prisma.user.upsert({
    where: { email: 'cliente@imobflow.com' },
    update: {},
    create: {
      email: 'cliente@imobflow.com',
      password: clientHash,
      name: 'Maria Cliente',
      phone: '11888888888',
      role: 'CLIENTE',
    },
  });

  let development = await prisma.development.findFirst({ where: { name: 'Residencial Vista Verde' } });
  if (!development) {
    development = await prisma.development.create({
      data: {
        name: 'Residencial Vista Verde',
        description: 'Loteamento premium com área de lazer',
        city: 'São Paulo',
        neighborhood: 'Vila Mariana',
      },
    });
  }

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

  await prisma.property.create({
    data: {
      title: 'Casa com 3 quartos - Vila Mariana',
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
      userId: broker.id,
      developmentId: development.id,
    },
  });

  console.log('Seed executado com sucesso!');
  console.log('Admin:', admin.email, '/ admin123');
  console.log('Corretor:', broker.email, '/ corretor123');
  console.log('Cliente:', client.email, '/ cliente123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
