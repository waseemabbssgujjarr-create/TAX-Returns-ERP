-- IRIS filing foundation
-- Adds a WEALTH_STATEMENT document category and a dedicated iris_filings table
-- that tracks submission attempts to FBR/IRIS honestly (defaults to a
-- "not yet integrated" state — never implies a successful filing).

ALTER TYPE "DocumentCategory" ADD VALUE 'WEALTH_STATEMENT';

CREATE TYPE "IrisFilingStatus" AS ENUM (
  'DRAFT',
  'READY',
  'PENDING_INTEGRATION',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'FAILED'
);

CREATE TYPE "IrisFilingChannel" AS ENUM ('MANUAL_PORTAL', 'API');

CREATE TABLE "iris_filings" (
    "id" TEXT NOT NULL,
    "tax_year_file_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" "IrisFilingStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" "IrisFilingChannel" NOT NULL DEFAULT 'MANUAL_PORTAL',
    "iris_reference_no" TEXT,
    "response_json" JSONB,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iris_filings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "iris_filings_tax_year_file_id_key" ON "iris_filings"("tax_year_file_id");
CREATE INDEX "iris_filings_firm_id_status_idx" ON "iris_filings"("firm_id", "status");
CREATE INDEX "iris_filings_client_id_idx" ON "iris_filings"("client_id");

ALTER TABLE "iris_filings" ADD CONSTRAINT "iris_filings_tax_year_file_id_fkey"
  FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iris_filings" ADD CONSTRAINT "iris_filings_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iris_filings" ADD CONSTRAINT "iris_filings_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE iris_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE iris_filings FORCE ROW LEVEL SECURITY;
CREATE POLICY iris_filings_isolation ON iris_filings
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::text)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::text);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE iris_filings TO taxdesk_app;
  END IF;
END $$;
