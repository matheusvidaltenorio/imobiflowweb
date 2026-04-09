-- CreateEnum
CREATE TYPE "DevelopmentGeocodingStatus" AS ENUM ('VERIFIED', 'APPROXIMATE', 'PENDING');

-- AlterTable
ALTER TABLE "Development" ADD COLUMN "street" TEXT,
ADD COLUMN "street_number" TEXT,
ADD COLUMN "place_name" TEXT,
ADD COLUMN "geocoding_status" "DevelopmentGeocodingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "geocoding_confidence" DECIMAL(6,4),
ADD COLUMN "polygon_source" TEXT,
ADD COLUMN "location_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DevelopmentNearbyPlace" (
    "id" TEXT NOT NULL,
    "development_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "short_address" TEXT,
    "source" TEXT NOT NULL DEFAULT 'overpass',
    "source_osm_id" TEXT,
    "search_radius_meters" INTEGER NOT NULL DEFAULT 3000,
    "distance_meters" INTEGER,
    "travel_time_minutes" INTEGER,
    "travel_mode" TEXT NOT NULL DEFAULT 'driving',
    "route_source" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentNearbyPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevelopmentNearbyPlace_development_id_idx" ON "DevelopmentNearbyPlace"("development_id");

-- CreateIndex
CREATE INDEX "DevelopmentNearbyPlace_category_idx" ON "DevelopmentNearbyPlace"("category");

-- CreateIndex
CREATE INDEX "Development_geocoding_status_idx" ON "Development"("geocoding_status");

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentNearbyPlace_development_id_source_source_osm_id_tr_key" ON "DevelopmentNearbyPlace"("development_id", "source", "source_osm_id", "travel_mode", "search_radius_meters");

-- AddForeignKey
ALTER TABLE "DevelopmentNearbyPlace" ADD CONSTRAINT "DevelopmentNearbyPlace_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;
