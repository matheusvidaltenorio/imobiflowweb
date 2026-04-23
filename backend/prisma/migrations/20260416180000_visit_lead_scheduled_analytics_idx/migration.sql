-- Agregações analytics: visitas por lead + período
CREATE INDEX IF NOT EXISTS "Visit_leadId_scheduledAt_idx" ON "Visit"("leadId", "scheduledAt");
