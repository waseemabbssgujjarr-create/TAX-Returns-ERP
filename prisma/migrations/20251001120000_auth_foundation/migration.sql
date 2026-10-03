-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MANAGER', 'ASSOCIATE', 'REVIEWER', 'CLIENT');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('SALARIED_INDIVIDUAL', 'BUSINESS_INDIVIDUAL', 'AOP_PARTNERSHIP', 'PRIVATE_LIMITED', 'PROPERTY_OWNER', 'OVERSEAS_PAKISTANI', 'FREELANCER_IT_EXPORTER', 'NON_PROFIT');

-- CreateEnum
CREATE TYPE "FilerStatus" AS ENUM ('FILER', 'NON_FILER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TaxYearStatus" AS ENUM ('INTAKE', 'IN_PROGRESS', 'UNDER_REVIEW', 'APPROVED', 'FILED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'EXTRACTED', 'REVIEWED', 'VERIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "firms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "idleTimeoutMinutes" INTEGER NOT NULL DEFAULT 0,
    "encryptedDataKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firms_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FirmDirectory (bootstrap only — no sensitive fields, no FK to firms)
-- Synced via SECURITY DEFINER trigger; taxdesk_app has SELECT-only.
CREATE TABLE "firm_directory" (
    "firm_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,

    CONSTRAINT "firm_directory_pkey" PRIMARY KEY ("firm_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ASSOCIATE',
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_setup_pending_secret" TEXT,
    "totp_verified_at" TIMESTAMP(3),
    "phone_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "jwt_family" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "contact_hmac" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "type" "ClientType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "cnic_encrypted" BYTEA,
    "ntn_encrypted" BYTEA,
    "filer_status" "FilerStatus" NOT NULL DEFAULT 'UNKNOWN',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "ai_consent_given" BOOLEAN NOT NULL DEFAULT false,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_access" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_year_files" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "status" "TaxYearStatus" NOT NULL DEFAULT 'INTAKE',
    "assignee_id" TEXT,
    "due_date" TIMESTAMP(3),
    "rules_version" TEXT,
    "filed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_year_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tax_year_file_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "document_type" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "extracted_fields" JSONB,
    "confidence" DOUBLE PRECISION,
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "ai_call_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- IC-3: user_id ON DELETE SET NULL; firm_id ON DELETE RESTRICT; no CASCADE erase of history
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "document_id" TEXT,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_paisa_est" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "firms_slug_key" ON "firms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "firm_directory_slug_key" ON "firm_directory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_firm_id_email_key" ON "users"("firm_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_firm_id_idx" ON "refresh_tokens"("firm_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_jwt_family_idx" ON "refresh_tokens"("jwt_family");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "recovery_codes_user_id_idx" ON "recovery_codes"("user_id");

-- CreateIndex
CREATE INDEX "otp_codes_firm_id_contact_hmac_idx" ON "otp_codes"("firm_id", "contact_hmac");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "client_access_client_id_user_id_key" ON "client_access"("client_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_year_files_client_id_tax_year_key" ON "tax_year_files"("client_id", "tax_year");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_access" ADD CONSTRAINT "client_access_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_access" ADD CONSTRAINT "client_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_year_files" ADD CONSTRAINT "tax_year_files_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tax_year_file_id_fkey" FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey — IC-3: RESTRICT on firm (retain audit history)
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — IC-3: SET NULL on user (preserve historical events)
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- FirmDirectory sync trigger (SECURITY DEFINER — taxdesk_app cannot write to
-- firm_directory; the trigger must run as the table owner / migrations role)
-- =============================================================================
CREATE OR REPLACE FUNCTION sync_firm_directory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO firm_directory (firm_id, slug, is_active)
    VALUES (NEW.id, NEW.slug, NEW."isActive");
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE firm_directory
    SET slug = NEW.slug, is_active = NEW."isActive"
    WHERE firm_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM firm_directory WHERE firm_id = OLD.id;
  END IF;
  RETURN NULL;
END;
$$;

-- Ensure the function is owned by taxdesk_migrations so SECURITY DEFINER
-- elevates to the role that can write firm_directory.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_migrations') THEN
    ALTER FUNCTION sync_firm_directory() OWNER TO taxdesk_migrations;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_firm_directory_sync ON firms;
CREATE TRIGGER trg_firm_directory_sync
  AFTER INSERT OR UPDATE OF slug, "isActive" OR DELETE ON firms
  FOR EACH ROW EXECUTE FUNCTION sync_firm_directory();

-- =============================================================================
-- Row Level Security (FORCE RLS — even table owner subject when non-superuser)
-- =============================================================================
ALTER TABLE firm_directory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE firms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_access    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_year_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_logs     ENABLE ROW LEVEL SECURITY;

ALTER TABLE firm_directory   FORCE ROW LEVEL SECURITY;
ALTER TABLE firms            FORCE ROW LEVEL SECURITY;
ALTER TABLE users            FORCE ROW LEVEL SECURITY;
ALTER TABLE clients          FORCE ROW LEVEL SECURITY;
ALTER TABLE client_access    FORCE ROW LEVEL SECURITY;
ALTER TABLE tax_year_files   FORCE ROW LEVEL SECURITY;
ALTER TABLE documents        FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens   FORCE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes   FORCE ROW LEVEL SECURITY;
ALTER TABLE otp_codes        FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_call_logs     FORCE ROW LEVEL SECURITY;

-- firm_directory: open SELECT (no sensitive fields).
-- Write policies are intentionally permissive at the RLS layer so the
-- SECURITY DEFINER sync trigger (owned by taxdesk_migrations) can INSERT/UPDATE/DELETE.
-- Runtime writes remain blocked by REVOKE INSERT/UPDATE/DELETE FROM taxdesk_app.
CREATE POLICY firm_directory_open_read ON firm_directory
  FOR SELECT USING (true);

CREATE POLICY firm_directory_trigger_write ON firm_directory
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY firm_directory_trigger_update ON firm_directory
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY firm_directory_trigger_delete ON firm_directory
  FOR DELETE
  USING (true);

-- firms: strict isolation
CREATE POLICY firms_isolation ON firms
  FOR ALL
  USING (id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (id = NULLIF(current_setting('app.current_firm_id', true), ''));

-- users
CREATE POLICY users_isolation ON users
  FOR ALL
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

-- clients: staff see all firm clients; portal sees only own client
CREATE POLICY clients_staff ON clients
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  );

CREATE POLICY clients_portal ON clients
  FOR SELECT
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'portal'
    AND id::text = current_setting('app.current_client_id', true)
  );

-- client_access via clients subquery
CREATE POLICY client_access_isolation ON client_access
  FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients
      WHERE firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    )
  );

-- tax_year_files via clients subquery
CREATE POLICY tax_year_files_isolation ON tax_year_files
  FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients
      WHERE firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    )
  );

-- documents
CREATE POLICY documents_isolation ON documents
  FOR ALL
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

-- refresh_tokens: firm + user scoped for authenticated sessions;
-- firm-only when app.auth_flow = 'refresh_rotation' (pre-auth cookie rotation —
-- possession of the opaque token hash is the proof of ownership).
CREATE POLICY refresh_tokens_isolation ON refresh_tokens
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND (
      user_id::text = current_setting('app.current_user_id', true)
      OR current_setting('app.auth_flow', true) = 'refresh_rotation'
    )
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND (
      user_id::text = current_setting('app.current_user_id', true)
      OR current_setting('app.auth_flow', true) = 'refresh_rotation'
    )
  );

-- recovery_codes: user owns their codes
CREATE POLICY recovery_codes_isolation ON recovery_codes
  FOR ALL
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- otp_codes: firm-scoped
CREATE POLICY otp_codes_isolation ON otp_codes
  FOR ALL
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

-- audit_logs: firm-scoped (INSERT-only at privilege layer)
CREATE POLICY audit_logs_isolation ON audit_logs
  FOR ALL
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

-- ai_call_logs: firm-scoped
CREATE POLICY ai_call_logs_isolation ON ai_call_logs
  FOR ALL
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

-- =============================================================================
-- Post-migration privilege restrictions (idempotent)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    REVOKE UPDATE, DELETE ON TABLE audit_logs FROM taxdesk_app;
    REVOKE TRUNCATE ON TABLE audit_logs FROM taxdesk_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE firm_directory FROM taxdesk_app;
    REVOKE TRUNCATE ON TABLE firm_directory FROM taxdesk_app;
  END IF;
END
$$;
