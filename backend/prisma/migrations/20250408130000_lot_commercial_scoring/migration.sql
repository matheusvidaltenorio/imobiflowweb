-- AlterTable Lot: inteligência comercial e score de venda
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "contactCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "scheduledVisitsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "proposalsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "availableSince" TIMESTAMP(3);
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "manualHighlight" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "saleScore" DECIMAL(5,2);
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "saleClassification" TEXT;
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "saleScoreReason" TEXT;
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "scoredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lot_saleScore_idx" ON "Lot"("saleScore");

-- AlterTable Lead: observações
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Backfill: data aproximada de “disponível” para lotes já marcados como disponíveis
UPDATE "Lot"
SET "availableSince" = "createdAt"
WHERE "status" = 'DISPONIVEL' AND "availableSince" IS NULL;
