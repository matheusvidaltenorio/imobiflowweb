-- Campos de sincronização e página padrão (Meta)
ALTER TABLE "social_connections" ADD COLUMN "last_sync_at" TIMESTAMP(3);
ALTER TABLE "social_connections" ADD COLUMN "last_error" TEXT;
ALTER TABLE "social_connections" ADD COLUMN "granted_scopes" TEXT;
ALTER TABLE "social_connections" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "social_connections_user_id_is_default_idx" ON "social_connections"("user_id", "is_default");

-- Auditoria de integração / publicação
CREATE TABLE "social_integration_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "channel" TEXT,
    "campaign_id" TEXT,
    "social_connection_id" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "external_id" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_integration_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "social_integration_logs_user_id_idx" ON "social_integration_logs"("user_id");
CREATE INDEX "social_integration_logs_campaign_id_idx" ON "social_integration_logs"("campaign_id");
CREATE INDEX "social_integration_logs_created_at_idx" ON "social_integration_logs"("created_at");

ALTER TABLE "social_integration_logs" ADD CONSTRAINT "social_integration_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_integration_logs" ADD CONSTRAINT "social_integration_logs_social_connection_id_fkey" FOREIGN KEY ("social_connection_id") REFERENCES "social_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
