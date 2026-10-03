-- Client CRM foundation: notes, lookup HMACs, search helpers, indexes
-- Note: all tenant IDs are TEXT (Prisma String), not PostgreSQL uuid type.

ALTER TABLE "clients" ADD COLUMN "cnic_lookup_hmac" TEXT;
ALTER TABLE "clients" ADD COLUMN "ntn_lookup_hmac" TEXT;
ALTER TABLE "clients" ADD COLUMN "cnic_last4" TEXT;
ALTER TABLE "clients" ADD COLUMN "ntn_last4" TEXT;
ALTER TABLE "clients" ADD COLUMN "cnic_masked" TEXT;
ALTER TABLE "clients" ADD COLUMN "ntn_masked" TEXT;

CREATE UNIQUE INDEX "clients_firm_id_cnic_lookup_hmac_key"
  ON "clients"("firm_id", "cnic_lookup_hmac")
  WHERE "cnic_lookup_hmac" IS NOT NULL;

CREATE UNIQUE INDEX "clients_firm_id_ntn_lookup_hmac_key"
  ON "clients"("firm_id", "ntn_lookup_hmac")
  WHERE "ntn_lookup_hmac" IS NOT NULL;

CREATE INDEX "clients_firm_id_display_name_idx" ON "clients"("firm_id", "display_name");
CREATE INDEX "clients_firm_id_is_archived_idx" ON "clients"("firm_id", "is_archived");

CREATE TABLE "client_notes" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "client_notes_client_id_created_at_idx"
  ON "client_notes"("client_id", "created_at" DESC);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY client_notes_staff ON client_notes
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  );

-- Ensure runtime role has DML on the new table (default privileges should cover this;
-- explicit grant is belt-and-suspenders for existing ALTER DEFAULT PRIVILEGES setup).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE client_notes TO taxdesk_app;
  END IF;
END
$$;
