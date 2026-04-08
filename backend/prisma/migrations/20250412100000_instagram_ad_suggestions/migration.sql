-- CreateEnum
CREATE TYPE "InstagramContentType" AS ENUM ('FEED', 'STORY', 'REEL', 'CARROSSEL', 'ANUNCIO_PATROCINADO', 'WHATSAPP_BRIDGE');

CREATE TYPE "InstagramAdTone" AS ENUM (
  'PROFISSIONAL',
  'CONSULTIVO',
  'PERSUASIVO',
  'PREMIUM',
  'POPULAR',
  'URGENTE_SUAVE',
  'AUTO'
);

CREATE TYPE "InstagramAdObjective" AS ENUM (
  'CAPTAR_LEADS',
  'WHATSAPP',
  'DESTACAR_CAMPEAO',
  'REATIVAR_ENCALHADO',
  'LANCAMENTO',
  'OPORTUNIDADE',
  'CONDICAO_ESPECIAL',
  'LOCALIZACAO',
  'VISITA',
  'AUTO'
);

-- CreateTable
CREATE TABLE "InstagramAdSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lotId" TEXT,
    "developmentId" TEXT,
    "contentType" "InstagramContentType" NOT NULL,
    "objective" "InstagramAdObjective" NOT NULL,
    "toneRequested" "InstagramAdTone",
    "strategicNote" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstagramAdSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstagramAdSuggestion_userId_idx" ON "InstagramAdSuggestion"("userId");
CREATE INDEX "InstagramAdSuggestion_lotId_idx" ON "InstagramAdSuggestion"("lotId");
CREATE INDEX "InstagramAdSuggestion_developmentId_idx" ON "InstagramAdSuggestion"("developmentId");
CREATE INDEX "InstagramAdSuggestion_createdAt_idx" ON "InstagramAdSuggestion"("createdAt");

ALTER TABLE "InstagramAdSuggestion" ADD CONSTRAINT "InstagramAdSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstagramAdSuggestion" ADD CONSTRAINT "InstagramAdSuggestion_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstagramAdSuggestion" ADD CONSTRAINT "InstagramAdSuggestion_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE SET NULL ON UPDATE CASCADE;
