-- Tax year workspace sections + computation snapshots
-- Note: all tenant IDs are TEXT (Prisma String), not PostgreSQL uuid type.

ALTER TABLE "tax_year_files" ADD COLUMN "sections" JSONB NOT NULL DEFAULT '{}';

CREATE TYPE "TaxComputationStatus" AS ENUM (
  'SUCCESS',
  'VALIDATION_FAILED',
  'RULES_UNAVAILABLE',
  'ENGINE_ERROR'
);

CREATE TABLE "tax_computation_snapshots" (
    "id" TEXT NOT NULL,
    "tax_year_file_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "status" "TaxComputationStatus" NOT NULL,
    "rules_version" TEXT,
    "result_json" JSONB,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "validation_errors" JSONB NOT NULL DEFAULT '[]',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_computation_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_computation_snapshots_tax_year_file_id_created_at_idx"
  ON "tax_computation_snapshots"("tax_year_file_id", "created_at" DESC);

CREATE INDEX "tax_computation_snapshots_firm_id_idx"
  ON "tax_computation_snapshots"("firm_id");

ALTER TABLE "tax_computation_snapshots" ADD CONSTRAINT "tax_computation_snapshots_tax_year_file_id_fkey"
  FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tax_computation_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tax_computation_snapshots" FORCE ROW LEVEL SECURITY;

CREATE POLICY tax_computation_snapshots_isolation ON tax_computation_snapshots
  USING (
    firm_id = current_setting('app.current_firm_id', true)
  )
  WITH CHECK (
    firm_id = current_setting('app.current_firm_id', true)
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tax_computation_snapshots TO taxdesk_app;
  END IF;
END
$$;
