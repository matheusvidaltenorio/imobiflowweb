-- Enums comerciais (camada produto)
CREATE TYPE "MarketingCampaignKind" AS ENUM ('LOTEMENTO', 'LOTE', 'INSTITUCIONAL', 'PROMOCAO', 'REENGAJAMENTO');
CREATE TYPE "CommercialObjective" AS ENUM ('GERAR_LEADS', 'GERAR_VISITAS', 'DIVULGAR_LOTES', 'FORTALECER_MARCA');

-- Novos status de campanha (publicação / agendamento)
ALTER TYPE "MarketingCampaignStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "MarketingCampaignStatus" ADD VALUE 'PUBLISHED';
ALTER TYPE "MarketingCampaignStatus" ADD VALUE 'FAILED';

-- Loteamento opcional (campanhas institucionais)
ALTER TABLE "marketing_campaigns" DROP CONSTRAINT "marketing_campaigns_development_id_fkey";
ALTER TABLE "marketing_campaigns" ALTER COLUMN "development_id" DROP NOT NULL;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketing_campaigns" ADD COLUMN "block_id" TEXT;
ALTER TABLE "marketing_campaigns" ADD COLUMN "campaign_kind" "MarketingCampaignKind" NOT NULL DEFAULT 'LOTEMENTO';
ALTER TABLE "marketing_campaigns" ADD COLUMN "commercial_objective" "CommercialObjective";
ALTER TABLE "marketing_campaigns" ADD COLUMN "internal_description" TEXT;
ALTER TABLE "marketing_campaigns" ADD COLUMN "audience_notes" TEXT;
ALTER TABLE "marketing_campaigns" ADD COLUMN "primary_caption" TEXT;
ALTER TABLE "marketing_campaigns" ADD COLUMN "scheduled_publish_at" TIMESTAMP(3);

CREATE INDEX "marketing_campaigns_block_id_idx" ON "marketing_campaigns"("block_id");
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing_campaigns"("status");
CREATE INDEX "marketing_campaigns_campaign_kind_idx" ON "marketing_campaigns"("campaign_kind");
CREATE INDEX "marketing_campaigns_scheduled_publish_at_idx" ON "marketing_campaigns"("scheduled_publish_at");

ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Referência à imagem da galeria do imóvel (sem duplicar arquivo na origem)
ALTER TABLE "campaign_assets" ADD COLUMN "source_property_image_id" TEXT;
CREATE INDEX "campaign_assets_source_property_image_id_idx" ON "campaign_assets"("source_property_image_id");
ALTER TABLE "campaign_assets" ADD CONSTRAINT "campaign_assets_source_property_image_id_fkey" FOREIGN KEY ("source_property_image_id") REFERENCES "PropertyImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
