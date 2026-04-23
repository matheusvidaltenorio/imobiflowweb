-- Campos opcionais para alertas de disponibilidade / match (in-app).
ALTER TABLE "InAppNotification" ADD COLUMN IF NOT EXISTS "development_id" TEXT;
ALTER TABLE "InAppNotification" ADD COLUMN IF NOT EXISTS "lot_id" TEXT;
ALTER TABLE "InAppNotification" ADD COLUMN IF NOT EXISTS "daily_availability_id" TEXT;

CREATE INDEX IF NOT EXISTS "InAppNotification_userId_development_id_idx" ON "InAppNotification" ("userId", "development_id");
CREATE INDEX IF NOT EXISTS "InAppNotification_daily_availability_id_idx" ON "InAppNotification" ("daily_availability_id");
CREATE INDEX IF NOT EXISTS "InAppNotification_userId_type_daily_availability_id_lot_id_idx" ON "InAppNotification" ("userId", "type", "daily_availability_id", "lot_id");
