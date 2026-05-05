/**
 * Seed de homologação (homolog_seed_v1).
 *
 * Complementa o seed base + catálogo + demo-universe. Usuários vêm de
 * `test-users.seed.ts` (@teste.com / 123456).
 *
 * Orquestração: ver `seedHomologUniverse` e README.md (credenciais).
 */
import type { PrismaClient } from '@prisma/client';
import { seedHomologUsers } from './users';
import { seedHomologCrm } from './crm';
import { seedHomologFinance } from './finance';
import { seedHomologMarketing } from './marketing';
import { seedHomologExtras } from './extras';

export { HOMOLOG_SOURCE, HOMOLOG_PASSWORD_PLAIN } from './types';
export type { HomologSeedContext } from './types';

export async function seedHomologUniverse(prisma: PrismaClient): Promise<void> {
  console.log('\n========================================');
  console.log('[homolog] IMOBFLOW — ambiente de homologação (idempotente)');
  console.log('========================================');
  const ctx = await seedHomologUsers(prisma);
  await seedHomologCrm(prisma, ctx);
  await seedHomologFinance(prisma, ctx);
  await seedHomologMarketing(prisma, ctx);
  await seedHomologExtras(prisma, ctx);
  console.log('[homolog] concluído.');
  console.log('[homolog] mesmos logins @teste.com — senha 123456 (ver README / test-users.seed.ts).');
}
