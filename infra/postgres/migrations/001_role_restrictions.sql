-- =============================================================================
-- TaxDesk PK — Role Restrictions (applied after Prisma migrations create tables)
--
-- This file is run AFTER "prisma migrate deploy" so that tables exist.
-- Included in the CI pipeline as a separate step.
-- Idempotent: safe to re-run.
-- =============================================================================

-- ── audit_logs: INSERT-only for taxdesk_app ────────────────────────────────
-- taxdesk_app does NOT own audit_logs (taxdesk_migrations owns it via Prisma).
-- REVOKE is therefore an absolute restriction — not bypassable by taxdesk_app.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    REVOKE UPDATE, DELETE ON TABLE audit_logs FROM taxdesk_app;
    REVOKE TRUNCATE       ON TABLE audit_logs FROM taxdesk_app;
  END IF;
END
$$;

-- ── firm_directory: SELECT-only for taxdesk_app (written by trigger only) ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'firm_directory'
  ) THEN
    REVOKE INSERT, UPDATE, DELETE ON TABLE firm_directory FROM taxdesk_app;
    REVOKE TRUNCATE               ON TABLE firm_directory FROM taxdesk_app;
  END IF;
END
$$;

-- ── FORCE ROW LEVEL SECURITY on all tenant-scoped tables ──────────────────
-- FORCE RLS makes the policies apply even to the table owner when connecting
-- as a non-superuser session. Without FORCE RLS, the owner bypasses policies.
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'firms', 'firm_directory', 'users', 'clients', 'client_access',
      'tax_year_files', 'documents', 'audit_logs', 'refresh_tokens',
      'recovery_codes', 'otp_codes', 'ai_call_logs'
    )
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END
$$;

-- ── Assertions (run these in CI after applying this file) ──────────────────
-- 1. taxdesk_app owns no tables:
--    SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public' AND tableowner = 'taxdesk_app';
--    Expected: 0 rows.
--
-- 2. taxdesk_app cannot TRUNCATE audit_logs:
--    SET ROLE taxdesk_app;
--    TRUNCATE audit_logs;
--    Expected: ERROR: permission denied for table audit_logs
--
-- 3. taxdesk_app cannot CREATE TABLE:
--    SET ROLE taxdesk_app;
--    CREATE TABLE _ddl_test (id int);
--    Expected: ERROR: permission denied for schema public
--
-- 4. taxdesk_app cannot UPDATE audit_logs:
--    SET ROLE taxdesk_app;
--    UPDATE audit_logs SET action = 'tampered' WHERE false;
--    Expected: ERROR: permission denied for table audit_logs
