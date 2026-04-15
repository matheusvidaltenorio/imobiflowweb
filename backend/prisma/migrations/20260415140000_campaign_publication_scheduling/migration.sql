-- Novos valores do enum de status operacional (PostgreSQL: apenas ADD VALUE)
DO $$ BEGIN ALTER TYPE "MarketingCampaignStatus" ADD VALUE 'QUEUED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "MarketingCampaignStatus" ADD VALUE 'PROCESSING'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "MarketingCampaignStatus" ADD VALUE 'RETRYING'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "MarketingCampaignStatus" ADD VALUE 'CANCELED'; EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "schedule_timezone" TEXT DEFAULT 'America/Sao_Paulo';
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "scheduled_channels_json" JSONB;
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "scheduled_social_connection_id" TEXT;
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "auto_retry_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "max_retries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "last_publish_attempt_at" TIMESTAMP(3);
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP(3);
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "campaign_published_at" TIMESTAMP(3);
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "publish_failure_reason" TEXT;
ALTER TABLE "marketing_campaigns" ADD COLUMN IF NOT EXISTS "publication_lock_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "marketing_campaigns_next_retry_at_idx" ON "marketing_campaigns"("next_retry_at");
CREATE INDEX IF NOT EXISTS "marketing_campaigns_status_scheduled_publish_at_idx" ON "marketing_campaigns"("status", "scheduled_publish_at");

CREATE TABLE IF NOT EXISTS "campaign_publication_op_logs" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "channel" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "external_post_id" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 0,
    "executed_by_user_id" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_publication_op_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_publication_op_logs_campaign_id_idx" ON "campaign_publication_op_logs"("campaign_id");
CREATE INDEX IF NOT EXISTS "campaign_publication_op_logs_created_at_idx" ON "campaign_publication_op_logs"("created_at");

DO $$ BEGIN
  ALTER TABLE "campaign_publication_op_logs" ADD CONSTRAINT "campaign_publication_op_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "campaign_publication_op_logs" ADD CONSTRAINT "campaign_publication_op_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
