-- Google Drive per-user storage architecture.
-- Adds: documents.storage_* metadata, google_drive_connections (per-user,
-- envelope-encrypted refresh tokens), google_drive_oauth_states (pre-auth,
-- no RLS by design — see schema.prisma doc comment), and
-- google_drive_objects (internal provider key -> driveFileId bookkeeping).

CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'GOOGLE_DRIVE');
CREATE TYPE "GoogleDriveConnectionStatus" AS ENUM ('CONNECTED', 'REVOKED', 'ERROR');

-- ── documents: storage backend metadata ──────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_provider "StorageProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS storage_owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

CREATE INDEX IF NOT EXISTS "documents_storage_owner_user_id_idx" ON documents("storage_owner_user_id");

ALTER TABLE documents
  ADD CONSTRAINT "documents_storage_owner_user_id_fkey"
  FOREIGN KEY ("storage_owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── google_drive_connections ─────────────────────────────────────────────────
CREATE TABLE "google_drive_connections" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "google_account_email" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "wrapped_data_key" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT,
    "root_folder_id" TEXT,
    "status" "GoogleDriveConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_drive_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_drive_connections_firm_id_user_id_key" ON "google_drive_connections"("firm_id", "user_id");
CREATE INDEX "google_drive_connections_firm_id_is_default_idx" ON "google_drive_connections"("firm_id", "is_default");

ALTER TABLE "google_drive_connections" ADD CONSTRAINT "google_drive_connections_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_drive_connections" ADD CONSTRAINT "google_drive_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── google_drive_oauth_states (pre-auth bootstrap — NO RLS, see schema.prisma) ─
CREATE TABLE "google_drive_oauth_states" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_drive_oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "google_drive_oauth_states_expires_at_idx" ON "google_drive_oauth_states"("expires_at");

-- ── google_drive_objects (internal provider bookkeeping) ─────────────────────
CREATE TABLE "google_drive_objects" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "drive_file_id" TEXT NOT NULL,
    "drive_folder_id" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_drive_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_drive_objects_key_key" ON "google_drive_objects"("key");
CREATE INDEX "google_drive_objects_firm_id_idx" ON "google_drive_objects"("firm_id");

-- ── Row level security ────────────────────────────────────────────────────────
-- google_drive_connections: staff-only, firm-scoped (portal never touches storage config)
ALTER TABLE google_drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_connections FORCE ROW LEVEL SECURITY;

CREATE POLICY google_drive_connections_staff ON google_drive_connections
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  );

-- google_drive_objects: staff-only, firm-scoped (internal to storage provider;
-- accessed via a synthetic staff RLS context when no HTTP request identity
-- exists, e.g. background document-processor jobs — see rls-bootstrap.util.ts)
ALTER TABLE google_drive_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_objects FORCE ROW LEVEL SECURITY;

CREATE POLICY google_drive_objects_staff ON google_drive_objects
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  );

-- google_drive_oauth_states: intentionally NOT enabled — see model doc comment.
-- The id itself is the unguessable, single-use secret (crypto-random, >= 32 bytes).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE google_drive_connections TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE google_drive_oauth_states TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE google_drive_objects TO taxdesk_app;
  END IF;
END
$$;
