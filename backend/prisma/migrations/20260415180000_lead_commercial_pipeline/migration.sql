-- Pipeline comercial CRM: novos estágios de Lead + campos de follow-up e loteamento.

CREATE TYPE "LeadStatus_new" AS ENUM (
  'NOVO_LEAD',
  'EM_ATENDIMENTO',
  'VISITA_AGENDADA',
  'PROPOSTA_ENVIADA',
  'RESERVADO',
  'VENDIDO',
  'PERDIDO'
);

ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING (
  CASE "status"::text
    WHEN 'PROSPECCAO' THEN 'NOVO_LEAD'
    WHEN 'QUALIFICACAO' THEN 'EM_ATENDIMENTO'
    WHEN 'NEGOCIACAO' THEN 'PROPOSTA_ENVIADA'
    WHEN 'VENDIDO' THEN 'VENDIDO'
    WHEN 'PERDIDO' THEN 'PERDIDO'
    ELSE 'NOVO_LEAD'
  END::"LeadStatus_new"
);

ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NOVO_LEAD'::"LeadStatus_new";

DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "next_follow_up_at" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lost_reason" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "development_id" TEXT;

CREATE INDEX IF NOT EXISTS "Lead_development_id_idx" ON "Lead"("development_id");
CREATE INDEX IF NOT EXISTS "Lead_next_follow_up_at_idx" ON "Lead"("next_follow_up_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lead_development_id_fkey'
  ) THEN
    ALTER TABLE "Lead"
      ADD CONSTRAINT "Lead_development_id_fkey"
      FOREIGN KEY ("development_id") REFERENCES "Development"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
