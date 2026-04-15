-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('META_PAGE');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- AlterTable
ALTER TABLE "campaign_publication_targets" ADD COLUMN "raw_response_json" JSONB;

-- CreateTable
CREATE TABLE "social_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "account_label" TEXT,
    "facebook_page_id" TEXT NOT NULL,
    "facebook_page_name" TEXT,
    "instagram_user_id" TEXT,
    "instagram_username" TEXT,
    "access_token_enc" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3),
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_connections_user_id_facebook_page_id_key" ON "social_connections"("user_id", "facebook_page_id");

-- CreateIndex
CREATE INDEX "social_connections_user_id_idx" ON "social_connections"("user_id");

-- AddForeignKey
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
