-- AlterTable
ALTER TABLE "Development" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Development" ADD COLUMN IF NOT EXISTS "coverImageAlt" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Development_slug_key" ON "Development"("slug");
