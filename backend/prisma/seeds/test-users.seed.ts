import { GestoraPublishMode, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// ===== LOGIN DE TESTE (dev/homolog) =====
// Senha única para todos: 123456
// admin@teste.com / 123456
// corretor1@teste.com … corretor5@teste.com / 123456
// cliente1@teste.com … cliente5@teste.com / 123456
// gestora1@teste.com / 123456
// gestora2@teste.com / 123456
// ========================================

export const TEST_PASSWORD_PLAIN = '123456';

const LEGACY_ADMIN = ['admin@imobflow.com', 'admin.homolog@imobiflow.local'];
const LEGACY_BROKER = ['corretor@imobflow.com', 'corretor@imobiflow.com'];
const LEGACY_CLIENT = ['cliente@imobflow.com'];

type UserUpsertData = {
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  isActive?: boolean;
};

/**
 * Garante usuário no e-mail canônico, migrando registro legado se existir (preserva FKs).
 */
async function ensureCanonicalUser(
  prisma: PrismaClient,
  canonicalEmail: string,
  legacyEmails: string[],
  data: UserUpsertData,
) {
  const existing = await prisma.user.findUnique({ where: { email: canonicalEmail } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        password: data.password,
        name: data.name,
        role: data.role,
        ...(data.phone != null ? { phone: data.phone } : {}),
        isActive: data.isActive ?? true,
      },
    });
  }
  for (const legacy of legacyEmails) {
    const old = await prisma.user.findUnique({ where: { email: legacy } });
    if (old) {
      return prisma.user.update({
        where: { id: old.id },
        data: {
          email: canonicalEmail,
          password: data.password,
          name: data.name,
          role: data.role,
          ...(data.phone != null ? { phone: data.phone } : {}),
          isActive: data.isActive ?? true,
        },
      });
    }
  }
  return prisma.user.create({
    data: {
      email: canonicalEmail,
      password: data.password,
      name: data.name,
      role: data.role,
      ...(data.phone != null ? { phone: data.phone } : {}),
      isActive: data.isActive ?? true,
    },
  });
}

export type TestUsersResult = {
  admin: { id: string; email: string };
  brokers: Array<{ id: string; email: string; name: string }>;
  clients: Array<{ id: string; email: string }>;
  gestoras: Array<{ id: string; email: string }>;
};

/**
 * Corretores e clientes usados em demo + homolog (5 de cada).
 */
export const TEST_BROKER_EMAILS = [1, 2, 3, 4, 5].map((n) => `corretor${n}@teste.com`);
export const TEST_CLIENT_EMAILS = [1, 2, 3, 4, 5].map((n) => `cliente${n}@teste.com`);

export async function upsertTestUsers(prisma: PrismaClient): Promise<TestUsersResult> {
  const hash = await bcrypt.hash(TEST_PASSWORD_PLAIN, 10);

  const admin = await ensureCanonicalUser(prisma, 'admin@teste.com', LEGACY_ADMIN, {
    password: hash,
    name: 'Administrador',
    role: UserRole.ADMIN,
    phone: '11900000000',
  });

  const brokers: TestUsersResult['brokers'] = [];
  for (let i = 1; i <= 5; i += 1) {
    const email = `corretor${i}@teste.com`;
    const legacy =
      i === 1
        ? [...LEGACY_BROKER, 'demo.corretor.1@imobiflow.local', 'homolog.corretor.1@imobiflow.local']
        : [`demo.corretor.${i}@imobiflow.local`, `homolog.corretor.${i}@imobiflow.local`];
    const u = await ensureCanonicalUser(prisma, email, legacy, {
      password: hash,
      name: `Corretor ${i}`,
      role: UserRole.CORRETOR,
      phone: `1191000${String(i).padStart(4, '0')}`,
    });
    brokers.push({ id: u.id, email: u.email, name: u.name });
  }

  const clients: TestUsersResult['clients'] = [];
  for (let i = 1; i <= 5; i += 1) {
    const email = `cliente${i}@teste.com`;
    const legacy =
      i === 1
        ? [...LEGACY_CLIENT, 'demo.cliente.1@example.test', 'homolog.cliente.01@imobiflow.local']
        : [`demo.cliente.${i}@example.test`, `homolog.cliente.${String(i).padStart(2, '0')}@imobiflow.local`];
    const u = await ensureCanonicalUser(prisma, email, legacy, {
      password: hash,
      name: `Cliente ${i}`,
      role: UserRole.CLIENTE,
      phone: `1192000${String(i).padStart(4, '0')}`,
    });
    clients.push({ id: u.id, email: u.email });
  }

  const gestoras: TestUsersResult['gestoras'] = [];
  const g1 = await ensureCanonicalUser(prisma, 'gestora1@teste.com', ['homolog.gestora@imobiflow.local'], {
    password: hash,
    name: 'Gestora 1',
    role: UserRole.GESTORA,
    phone: '11930000001',
  });
  gestoras.push({ id: g1.id, email: g1.email });

  const g2 = await prisma.user.upsert({
    where: { email: 'gestora2@teste.com' },
    update: {
      password: hash,
      name: 'Gestora 2',
      role: UserRole.GESTORA,
      isActive: true,
      phone: '11930000002',
    },
    create: {
      email: 'gestora2@teste.com',
      password: hash,
      name: 'Gestora 2',
      role: UserRole.GESTORA,
      phone: '11930000002',
    },
  });
  gestoras.push({ id: g2.id, email: g2.email });

  const vista = await prisma.development.findFirst({
    where: { name: 'Residencial Vista Verde' },
    select: { id: true },
  });
  if (vista) {
    const acc1 = await prisma.managerDevelopmentAccess.findUnique({
      where: { userId_developmentId: { userId: g1.id, developmentId: vista.id } },
    });
    if (!acc1) {
      await prisma.managerDevelopmentAccess.create({
        data: {
          userId: g1.id,
          developmentId: vista.id,
          spreadsheetImportEnabled: true,
          assistedImageEnabled: true,
          publishMode: GestoraPublishMode.IMMEDIATE,
        },
      });
    }
  }

  return {
    admin: { id: admin.id, email: admin.email },
    brokers,
    clients,
    gestoras,
  };
}
