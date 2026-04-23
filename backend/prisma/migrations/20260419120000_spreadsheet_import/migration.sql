-- AlterEnum
ALTER TYPE "DailyAvailabilitySourceType" ADD VALUE 'SPREADSHEET';

-- AlterTable
ALTER TABLE "DailyAvailability" ADD COLUMN "import_metadata" JSONB;

-- CreateTable
CREATE TABLE "SpreadsheetImportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gestora_label" TEXT,
    "development_id" TEXT NOT NULL,
    "column_mapping" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpreadsheetImportTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpreadsheetImportTemplate_development_id_idx" ON "SpreadsheetImportTemplate"("development_id");

ALTER TABLE "SpreadsheetImportTemplate" ADD CONSTRAINT "SpreadsheetImportTemplate_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpreadsheetImportTemplate" ADD CONSTRAINT "SpreadsheetImportTemplate_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
