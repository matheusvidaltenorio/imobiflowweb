-- Expand loteamentos (capa, UF), lotes (views), leads (lote + CRM), visitas (lote), histórico

ALTER TABLE "Development" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Development" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "Development" ADD COLUMN IF NOT EXISTS "coverPublicId" TEXT;

ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_propertyId_fkey";
ALTER TABLE "Lead" ALTER COLUMN "propertyId" DROP NOT NULL;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadSource" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "isHot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "interactionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Lead_lotId_idx" ON "Lead"("lotId");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "LeadInteraction" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadInteraction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadInteraction_leadId_idx" ON "LeadInteraction"("leadId");
CREATE INDEX IF NOT EXISTS "LeadInteraction_userId_idx" ON "LeadInteraction"("userId");
ALTER TABLE "LeadInteraction" DROP CONSTRAINT IF EXISTS "LeadInteraction_leadId_fkey";
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadInteraction" DROP CONSTRAINT IF EXISTS "LeadInteraction_userId_fkey";
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Visit" DROP CONSTRAINT IF EXISTS "Visit_propertyId_fkey";
ALTER TABLE "Visit" ALTER COLUMN "propertyId" DROP NOT NULL;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Visit_lotId_idx" ON "Visit"("lotId");
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
