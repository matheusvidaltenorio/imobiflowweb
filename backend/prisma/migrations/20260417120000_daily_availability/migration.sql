-- CreateEnum
CREATE TYPE "DailyAvailabilitySourceType" AS ENUM ('IMAGE', 'CSV', 'TEXT', 'MANUAL');

-- CreateEnum
CREATE TYPE "LotDailySnapshotStatus" AS ENUM ('DISPONIVEL', 'RESERVADO', 'VENDIDO', 'NEGOCIACAO');

-- CreateTable
CREATE TABLE "DailyAvailability" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sourceType" "DailyAvailabilitySourceType" NOT NULL,
    "sourceFileUrl" TEXT,
    "notes" TEXT,
    "rawText" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotDailyStatus" (
    "id" TEXT NOT NULL,
    "dailyAvailabilityId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "status" "LotDailySnapshotStatus" NOT NULL,
    "price" DECIMAL(12,2),
    "notes" TEXT,

    CONSTRAINT "LotDailyStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyAvailability_developmentId_date_idx" ON "DailyAvailability"("developmentId", "date");

-- CreateIndex
CREATE INDEX "DailyAvailability_developmentId_date_createdAt_idx" ON "DailyAvailability"("developmentId", "date", "createdAt");

-- CreateIndex
CREATE INDEX "DailyAvailability_createdById_idx" ON "DailyAvailability"("createdById");

-- CreateIndex
CREATE INDEX "LotDailyStatus_lotId_idx" ON "LotDailyStatus"("lotId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "LotDailyStatus_dailyAvailabilityId_lotId_key" ON "LotDailyStatus"("dailyAvailabilityId", "lotId");

-- AddForeignKey
ALTER TABLE "DailyAvailability" ADD CONSTRAINT "DailyAvailability_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAvailability" ADD CONSTRAINT "DailyAvailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotDailyStatus" ADD CONSTRAINT "LotDailyStatus_dailyAvailabilityId_fkey" FOREIGN KEY ("dailyAvailabilityId") REFERENCES "DailyAvailability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotDailyStatus" ADD CONSTRAINT "LotDailyStatus_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
