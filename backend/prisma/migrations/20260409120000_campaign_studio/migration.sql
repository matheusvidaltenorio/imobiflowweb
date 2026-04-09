-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignAssetKind" AS ENUM ('IMAGE', 'VIDEO', 'GENERATED_IMAGE', 'UPLOADED_IMAGE', 'SYSTEM_IMAGE');

-- CreateEnum
CREATE TYPE "CampaignAssetOrigin" AS ENUM ('BANK', 'UPLOAD', 'AI');

-- CreateEnum
CREATE TYPE "PublicationPlatform" AS ENUM ('INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL', 'FACEBOOK_POST', 'WHATSAPP', 'EXPORT_PACKAGE');

-- CreateEnum
CREATE TYPE "PublicationTargetStatus" AS ENUM ('PREPARED', 'EXPORT_PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiImageJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "development_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "title" TEXT NOT NULL,
    "objective" "InstagramAdObjective" NOT NULL DEFAULT 'AUTO',
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "primary_content_type" "InstagramContentType" NOT NULL DEFAULT 'FEED',
    "pack_json" JSONB,
    "last_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_assets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "kind" "CampaignAssetKind" NOT NULL,
    "origin" "CampaignAssetOrigin" NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_publication_targets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "platform" "PublicationPlatform" NOT NULL,
    "aspect_hint" TEXT,
    "status" "PublicationTargetStatus" NOT NULL DEFAULT 'EXPORT_PENDING',
    "published_at" TIMESTAMP(3),
    "external_post_id" TEXT,
    "external_container_id" TEXT,
    "publish_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_publication_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_copies" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "platform" "PublicationPlatform" NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "short_caption" TEXT,
    "cta" TEXT,
    "hashtags" TEXT,
    "reel_script_json" JSONB,
    "professional_tone" TEXT,
    "persuasive_tone" TEXT,
    "direct_tone" TEXT,
    "justification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_image_generation_jobs" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "AiImageJobStatus" NOT NULL DEFAULT 'PENDING',
    "result_url" TEXT,
    "result_public_id" TEXT,
    "error_message" TEXT,
    "variation_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_image_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_campaigns_user_id_idx" ON "marketing_campaigns"("user_id");

-- CreateIndex
CREATE INDEX "marketing_campaigns_development_id_idx" ON "marketing_campaigns"("development_id");

-- CreateIndex
CREATE INDEX "marketing_campaigns_lot_id_idx" ON "marketing_campaigns"("lot_id");

-- CreateIndex
CREATE INDEX "marketing_campaigns_created_at_idx" ON "marketing_campaigns"("created_at");

-- CreateIndex
CREATE INDEX "campaign_assets_campaign_id_idx" ON "campaign_assets"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_publication_targets_campaign_id_platform_key" ON "campaign_publication_targets"("campaign_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_copies_campaign_id_platform_key" ON "campaign_copies"("campaign_id", "platform");

-- CreateIndex
CREATE INDEX "ai_image_generation_jobs_campaign_id_idx" ON "ai_image_generation_jobs"("campaign_id");

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_assets" ADD CONSTRAINT "campaign_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_publication_targets" ADD CONSTRAINT "campaign_publication_targets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_copies" ADD CONSTRAINT "campaign_copies_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_image_generation_jobs" ADD CONSTRAINT "ai_image_generation_jobs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
