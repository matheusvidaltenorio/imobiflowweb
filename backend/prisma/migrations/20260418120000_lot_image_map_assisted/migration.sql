-- Leitura assistida: template visual + metadados do fluxo assistido

ALTER TABLE "DailyAvailability" ADD COLUMN "assisted_metadata" JSONB;

CREATE TABLE "LotImageMap" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "xNorm" DECIMAL(8,7) NOT NULL,
    "yNorm" DECIMAL(8,7) NOT NULL,
    "wNorm" DECIMAL(8,7),
    "hNorm" DECIMAL(8,7),
    "refImageWidth" INTEGER,
    "refImageHeight" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotImageMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LotImageMap_lotId_key" ON "LotImageMap"("lotId");
CREATE INDEX "LotImageMap_developmentId_idx" ON "LotImageMap"("developmentId");

ALTER TABLE "LotImageMap" ADD CONSTRAINT "LotImageMap_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LotImageMap" ADD CONSTRAINT "LotImageMap_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LotImageMap" ADD CONSTRAINT "LotImageMap_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
