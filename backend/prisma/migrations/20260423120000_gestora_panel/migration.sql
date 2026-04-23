-- CreateEnum
CREATE TYPE "GestoraSubmissionStatus" AS ENUM ('PENDING_APPROVAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "GestoraPublishMode" AS ENUM ('IMMEDIATE', 'PENDING_REVIEW');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'GESTORA';

-- AlterTable
ALTER TABLE "DailyAvailability" ADD COLUMN "gestora_submission_status" "GestoraSubmissionStatus";

-- CreateIndex
CREATE INDEX "DailyAvailability_developmentId_date_gestora_submission_status_idx" ON "DailyAvailability"("developmentId", "date", "gestora_submission_status");

-- CreateTable
CREATE TABLE "ManagerDevelopmentAccess" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "development_id" TEXT NOT NULL,
    "permissions" JSONB,
    "spreadsheet_import_enabled" BOOLEAN NOT NULL DEFAULT true,
    "assisted_image_enabled" BOOLEAN NOT NULL DEFAULT true,
    "publish_mode" "GestoraPublishMode" NOT NULL DEFAULT 'IMMEDIATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerDevelopmentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerDevelopmentAccess_user_id_idx" ON "ManagerDevelopmentAccess"("user_id");

-- CreateIndex
CREATE INDEX "ManagerDevelopmentAccess_development_id_idx" ON "ManagerDevelopmentAccess"("development_id");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerDevelopmentAccess_user_id_development_id_key" ON "ManagerDevelopmentAccess"("user_id", "development_id");

-- AddForeignKey
ALTER TABLE "ManagerDevelopmentAccess" ADD CONSTRAINT "ManagerDevelopmentAccess_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerDevelopmentAccess" ADD CONSTRAINT "ManagerDevelopmentAccess_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;
