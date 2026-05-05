/**
 * Contexto compartilhado entre módulos do seed de homologação (homolog_seed_v1).
 * Ver README.md — seção "Homologação" — para credenciais.
 */
export type HomologSeedContext = {
  admin2Id: string;
  gestoraId: string;
  brokers: Array<{ id: string; email: string; name: string }>;
  clientUsers: Array<{ id: string; email: string }>;
  /** Registros CRM Client (tabela Client), alinhados por índice com clientUsers quando aplicável. */
  crmClients: Array<{ id: string; email: string; brokerId: string }>;
  vistaVerdeId: string;
  mainBrokerId: string;
  /** Primeiro loteamento demo Cariri (slug), se existir — para perfis de interesse. */
  demoDevId: string | null;
  /** Imóvel “Casa Vila Mariana” do seed legado (se existir). */
  legacyShowcasePropertyId: string | null;
};

export const HOMOLOG_SOURCE = 'homolog_seed_v1';
/** Alinhado ao seed de usuários de teste (`test-users.seed.ts`). */
export const HOMOLOG_PASSWORD_PLAIN = '123456';
