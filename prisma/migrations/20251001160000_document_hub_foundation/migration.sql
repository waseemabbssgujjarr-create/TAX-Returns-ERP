-- Document Hub foundation: pipeline fields, client denormalization, versioning
-- Note: all tenant IDs are TEXT (Prisma String), not PostgreSQL uuid type.

CREATE TYPE "DocumentCategory" AS ENUM (
  'UNCATEGORIZED',
  'SALARY_CERTIFICATE',
  'BANK_STATEMENT',
  'WITHHOLDING_STATEMENT',
  'PROPERTY_DOCUMENT',
  'INVESTMENT_STATEMENT',
  'OTHER'
);

CREATE TYPE "DocumentProcessingStatus" AS ENUM (
  'PENDING',
  'SECURITY_CHECK',
  'READING',
  'CLASSIFYING',
  'EXTRACTING',
  'READY',
  'FAILED'
);

CREATE TYPE "DocumentExtractionStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETE',
  'FAILED',
  'SKIPPED'
);

CREATE TYPE "DocumentReviewStatus" AS ENUM (
  'NOT_STARTED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED'
);

ALTER TABLE "documents" ADD COLUMN "client_id" TEXT;
ALTER TABLE "documents" ADD COLUMN "category" "DocumentCategory" NOT NULL DEFAULT 'UNCATEGORIZED';
ALTER TABLE "documents" ADD COLUMN "processing_status" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "documents" ADD COLUMN "extraction_status" "DocumentExtractionStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "documents" ADD COLUMN "review_status" "DocumentReviewStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "documents" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "documents" ADD COLUMN "previous_version_id" TEXT;
ALTER TABLE "documents" ADD COLUMN "uploaded_by_id" TEXT;

UPDATE "documents" AS d
SET "client_id" = tyf."client_id"
FROM "tax_year_files" AS tyf
WHERE d."tax_year_file_id" = tyf."id"
  AND d."client_id" IS NULL;

ALTER TABLE "documents" ALTER COLUMN "client_id" SET NOT NULL;

ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_previous_version_id_fkey"
  FOREIGN KEY ("previous_version_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "documents_firm_id_client_id_created_at_idx"
  ON "documents"("firm_id", "client_id", "created_at" DESC);

CREATE INDEX "documents_tax_year_file_id_idx" ON "documents"("tax_year_file_id");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE documents TO taxdesk_app;
  END IF;
END
$$;
