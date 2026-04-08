-- CreateEnum
CREATE TYPE "AiSuggestionMessageType" AS ENUM (
  'PRIMEIRO_CONTATO',
  'FOLLOW_UP',
  'VISITA',
  'OPORTUNIDADE',
  'RETOMADA',
  'URGENCIA',
  'POS_VISITA',
  'NEGOCIACAO',
  'REATIVACAO_ENCALHADO'
);

-- CreateEnum
CREATE TYPE "AiSuggestionTone" AS ENUM ('OBJETIVO', 'CONSULTIVO', 'PERSUASIVO');

-- CreateTable
CREATE TABLE "AiMessageSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "lotId" TEXT,
    "messageType" "AiSuggestionMessageType" NOT NULL,
    "tone" "AiSuggestionTone" NOT NULL,
    "message" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessageSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiMessageSuggestion_leadId_idx" ON "AiMessageSuggestion"("leadId");

-- CreateIndex
CREATE INDEX "AiMessageSuggestion_lotId_idx" ON "AiMessageSuggestion"("lotId");

-- CreateIndex
CREATE INDEX "AiMessageSuggestion_userId_idx" ON "AiMessageSuggestion"("userId");

-- CreateIndex
CREATE INDEX "AiMessageSuggestion_createdAt_idx" ON "AiMessageSuggestion"("createdAt");

-- AddForeignKey
ALTER TABLE "AiMessageSuggestion" ADD CONSTRAINT "AiMessageSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessageSuggestion" ADD CONSTRAINT "AiMessageSuggestion_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessageSuggestion" ADD CONSTRAINT "AiMessageSuggestion_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
