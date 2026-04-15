-- Atribuição de lead à campanha de marketing (analytics comercial)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "marketing_campaign_id" TEXT;

CREATE INDEX IF NOT EXISTS "Lead_marketing_campaign_id_idx" ON "Lead"("marketing_campaign_id");

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_marketing_campaign_id_fkey" FOREIGN KEY ("marketing_campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
