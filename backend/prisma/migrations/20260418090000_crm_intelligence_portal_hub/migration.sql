-- CRM inteligente: áudio, perfil, match, catálogos, portais

CREATE TYPE "AudioIngestionStatus" AS ENUM ('UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'EXTRACTED', 'FAILED', 'APPLIED');
CREATE TYPE "PropertyIntent" AS ENUM ('MORAR', 'INVESTIR', 'OUTRO');
CREATE TYPE "MatchTargetKind" AS ENUM ('LOT', 'PROPERTY');
CREATE TYPE "MatchSuggestionStatus" AS ENUM ('SUGGESTED', 'DISMISSED', 'SENT_TO_CLIENT', 'VISIT_SCHEDULED', 'CONVERTED');
CREATE TYPE "CatalogShareStatus" AS ENUM ('DRAFT', 'SENT', 'ARCHIVED');
CREATE TYPE "PortalCode" AS ENUM ('OLX', 'GRUPO_OLX_XML', 'ORULO', 'HOMER', 'DWV', 'CUSTOM');
CREATE TYPE "PortalListingLifecycleStatus" AS ENUM ('DRAFT', 'READY', 'PENDING_SYNC', 'PUBLISHED', 'FAILED', 'REMOVED', 'OUT_OF_SYNC');
CREATE TYPE "ExternalLeadIngestStatus" AS ENUM ('RECEIVED', 'DEDUPLICATED', 'CRM_LEAD_CREATED', 'FAILED');

CREATE TABLE "InterestProfile" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "budgetMin" DECIMAL(18,2),
    "budgetMax" DECIMAL(18,2),
    "preferredDevelopmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minArea" DECIMAL(14,2),
    "maxArea" DECIMAL(14,2),
    "propertyIntent" "PropertyIntent",
    "financingNotes" TEXT,
    "mustHaveTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "niceToHaveTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "urgencyLevel" TEXT,
    "extraJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterestProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InterestProfile_leadId_key" ON "InterestProfile"("leadId");
CREATE UNIQUE INDEX "InterestProfile_clientId_key" ON "InterestProfile"("clientId");

CREATE TABLE "AudioIngestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "publicId" TEXT,
    "mimeType" TEXT NOT NULL,
    "durationMs" INTEGER,
    "status" "AudioIngestionStatus" NOT NULL DEFAULT 'UPLOADED',
    "transcriptRaw" TEXT,
    "transcriptConfidence" DOUBLE PRECISION,
    "extractionJson" JSONB,
    "extractionError" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioIngestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchSuggestion" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" "MatchTargetKind" NOT NULL,
    "lotId" TEXT,
    "propertyId" TEXT,
    "score" DECIMAL(8,5) NOT NULL,
    "reasonsJson" JSONB NOT NULL,
    "status" "MatchSuggestionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "matchRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogShare" (
    "id" TEXT NOT NULL,
    "brokerUserId" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "shareToken" TEXT NOT NULL,
    "status" "CatalogShareStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogShare_shareToken_key" ON "CatalogShare"("shareToken");

CREATE TABLE "CatalogShareItem" (
    "id" TEXT NOT NULL,
    "catalogShareId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lotId" TEXT,
    "propertyId" TEXT,
    "brokerNote" TEXT,

    CONSTRAINT "CatalogShareItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalListing" (
    "id" TEXT NOT NULL,
    "lotId" TEXT,
    "propertyId" TEXT,
    "portal" "PortalCode" NOT NULL,
    "externalListingId" TEXT,
    "listingStatus" TEXT,
    "publicationStatus" "PortalListingLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "price" DECIMAL(18,2),
    "imagesSnapshot" JSONB,
    "payloadSnapshot" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalConnectorConfig" (
    "id" TEXT NOT NULL,
    "portal" "PortalCode" NOT NULL,
    "label" TEXT NOT NULL,
    "credentialsEnvKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalConnectorConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalConnectorConfig_portal_label_key" ON "PortalConnectorConfig"("portal", "label");

CREATE TABLE "ExternalPortalLead" (
    "id" TEXT NOT NULL,
    "portal" "PortalCode" NOT NULL,
    "externalLeadId" TEXT NOT NULL,
    "listingReference" TEXT,
    "rawPayload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "leadId" TEXT,
    "status" "ExternalLeadIngestStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalPortalLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalPortalLead_dedupeKey_key" ON "ExternalPortalLead"("dedupeKey");

CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "metadataJson" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InterestProfile_leadId_idx" ON "InterestProfile"("leadId");
CREATE INDEX "InterestProfile_clientId_idx" ON "InterestProfile"("clientId");

CREATE INDEX "AudioIngestion_userId_idx" ON "AudioIngestion"("userId");
CREATE INDEX "AudioIngestion_leadId_idx" ON "AudioIngestion"("leadId");
CREATE INDEX "AudioIngestion_clientId_idx" ON "AudioIngestion"("clientId");
CREATE INDEX "AudioIngestion_status_idx" ON "AudioIngestion"("status");

CREATE INDEX "MatchSuggestion_leadId_createdAt_idx" ON "MatchSuggestion"("leadId", "createdAt");
CREATE INDEX "MatchSuggestion_lotId_idx" ON "MatchSuggestion"("lotId");
CREATE INDEX "MatchSuggestion_propertyId_idx" ON "MatchSuggestion"("propertyId");

CREATE INDEX "CatalogShare_brokerUserId_idx" ON "CatalogShare"("brokerUserId");
CREATE INDEX "CatalogShare_leadId_idx" ON "CatalogShare"("leadId");
CREATE INDEX "CatalogShareItem_catalogShareId_idx" ON "CatalogShareItem"("catalogShareId");

CREATE INDEX "PortalListing_portal_idx" ON "PortalListing"("portal");
CREATE INDEX "PortalListing_lotId_idx" ON "PortalListing"("lotId");
CREATE INDEX "PortalListing_propertyId_idx" ON "PortalListing"("propertyId");
CREATE INDEX "PortalListing_publicationStatus_idx" ON "PortalListing"("publicationStatus");
CREATE INDEX "PortalListing_createdById_idx" ON "PortalListing"("createdById");

CREATE INDEX "ExternalPortalLead_portal_idx" ON "ExternalPortalLead"("portal");
CREATE INDEX "ExternalPortalLead_createdAt_idx" ON "ExternalPortalLead"("createdAt");
CREATE INDEX "ExternalPortalLead_status_idx" ON "ExternalPortalLead"("status");

CREATE INDEX "InAppNotification_userId_readAt_idx" ON "InAppNotification"("userId", "readAt");
CREATE INDEX "InAppNotification_createdAt_idx" ON "InAppNotification"("createdAt");

ALTER TABLE "InterestProfile" ADD CONSTRAINT "InterestProfile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterestProfile" ADD CONSTRAINT "InterestProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudioIngestion" ADD CONSTRAINT "AudioIngestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudioIngestion" ADD CONSTRAINT "AudioIngestion_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudioIngestion" ADD CONSTRAINT "AudioIngestion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogShare" ADD CONSTRAINT "CatalogShare_brokerUserId_fkey" FOREIGN KEY ("brokerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogShare" ADD CONSTRAINT "CatalogShare_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogShare" ADD CONSTRAINT "CatalogShare_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogShareItem" ADD CONSTRAINT "CatalogShareItem_catalogShareId_fkey" FOREIGN KEY ("catalogShareId") REFERENCES "CatalogShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortalListing" ADD CONSTRAINT "PortalListing_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalListing" ADD CONSTRAINT "PortalListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalListing" ADD CONSTRAINT "PortalListing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortalConnectorConfig" ADD CONSTRAINT "PortalConnectorConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExternalPortalLead" ADD CONSTRAINT "ExternalPortalLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
