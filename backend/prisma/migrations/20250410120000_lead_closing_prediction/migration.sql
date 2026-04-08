-- AlterTable Lead: previsão de fechamento
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadLastInteractionAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingScore" DECIMAL(5,2);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingPrediction" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingInterestLevel" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingPriorityLevel" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingNextAction" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingPositiveFactors" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingRiskFactors" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "closingScoreUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "previousClosingScore" DECIMAL(5,2);

CREATE INDEX IF NOT EXISTS "Lead_closingScore_idx" ON "Lead"("closingScore");

-- CreateTable
CREATE TABLE "LeadPredictionSnapshot" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "closingScore" DECIMAL(5,2) NOT NULL,
    "closingPrediction" TEXT NOT NULL,
    "closingReason" TEXT NOT NULL,
    "nextRecommendedAction" TEXT NOT NULL,
    "factorsJson" JSONB NOT NULL,
    "previousScore" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadPredictionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadPredictionSnapshot_leadId_idx" ON "LeadPredictionSnapshot"("leadId");
CREATE INDEX "LeadPredictionSnapshot_createdAt_idx" ON "LeadPredictionSnapshot"("createdAt");

ALTER TABLE "LeadPredictionSnapshot" ADD CONSTRAINT "LeadPredictionSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill última interação a partir da interação mais recente
UPDATE "Lead" L
SET "leadLastInteractionAt" = sub.mx
FROM (
  SELECT "leadId", MAX("createdAt") AS mx
  FROM "LeadInteraction"
  GROUP BY "leadId"
) sub
WHERE L.id = sub."leadId" AND L."leadLastInteractionAt" IS NULL;
