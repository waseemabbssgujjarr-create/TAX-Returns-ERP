-- Export artifacts foundation
CREATE TYPE "ExportArtifactStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
CREATE TYPE "ExportArtifactType" AS ENUM ('TAX_SUMMARY_PDF', 'RETURN_WORKSHEET', 'WEALTH_STATEMENT', 'AUDIT_LOG_CSV');

CREATE TABLE "export_artifacts" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "client_id" TEXT,
    "tax_year_file_id" TEXT,
    "export_type" "ExportArtifactType" NOT NULL,
    "status" "ExportArtifactStatus" NOT NULL DEFAULT 'PENDING',
    "storage_key" TEXT,
    "mime_type" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "rules_version" TEXT,
    "rules_state" TEXT,
    "error_message" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "export_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "export_artifacts_firm_id_created_at_idx" ON "export_artifacts"("firm_id", "created_at" DESC);
CREATE INDEX "export_artifacts_tax_year_file_id_idx" ON "export_artifacts"("tax_year_file_id");

ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_tax_year_file_id_fkey" FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE export_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_artifacts FORCE ROW LEVEL SECURITY;
CREATE POLICY export_artifacts_isolation ON export_artifacts
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::text)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::text);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE export_artifacts TO taxdesk_app;
  END IF;
END $$;
