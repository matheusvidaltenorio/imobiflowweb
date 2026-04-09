-- CreateEnum
CREATE TYPE "DevelopmentLocationPrecision" AS ENUM ('EXATA', 'APROXIMADA', 'PENDENTE');

-- AlterTable
ALTER TABLE "Development" ADD COLUMN "reference_address" TEXT,
ADD COLUMN "location_precision" "DevelopmentLocationPrecision" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN "location_notes" TEXT;
