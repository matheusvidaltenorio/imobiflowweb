-- AlterTable
ALTER TABLE "Simulation" ADD COLUMN     "lotId" TEXT,
ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "Simulation_lotId_idx" ON "Simulation"("lotId");

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
