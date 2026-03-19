-- AlterEnum: LeadStatus NOVO/EM_CONTATO/VISITA/CONVERTIDO/PERDIDO -> PROSPECCAO/QUALIFICACAO/NEGOCIACAO/VENDIDO/PERDIDO
CREATE TYPE "LeadStatus_new" AS ENUM ('PROSPECCAO', 'QUALIFICACAO', 'NEGOCIACAO', 'VENDIDO', 'PERDIDO');
ALTER TABLE "Lead" ADD COLUMN "status_new" "LeadStatus_new";
UPDATE "Lead" SET "status_new" = CASE
  WHEN "status"::text = 'NOVO' THEN 'PROSPECCAO'::"LeadStatus_new"
  WHEN "status"::text = 'EM_CONTATO' THEN 'QUALIFICACAO'::"LeadStatus_new"
  WHEN "status"::text = 'VISITA' THEN 'NEGOCIACAO'::"LeadStatus_new"
  WHEN "status"::text = 'CONVERTIDO' THEN 'VENDIDO'::"LeadStatus_new"
  WHEN "status"::text = 'PERDIDO' THEN 'PERDIDO'::"LeadStatus_new"
  ELSE 'PROSPECCAO'::"LeadStatus_new"
END;
ALTER TABLE "Lead" ALTER COLUMN "status_new" SET NOT NULL;
ALTER TABLE "Lead" DROP COLUMN "status";
ALTER TABLE "Lead" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'PROSPECCAO'::"LeadStatus_new";
DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
