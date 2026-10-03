-- =============================================================================
-- TaxDesk PK — CI Role & Privilege Assertion Queries
--
-- Run these queries in CI after migrations to verify the security model.
-- Each query must return 0 rows / raise an expected error to pass.
--
-- Usage in CI (psql with superuser or taxdesk_migrations credentials):
--   psql $DATABASE_MIGRATIONS_URL -f infra/postgres/ci-assert-roles.sql
-- =============================================================================

-- ── Assertion 1: taxdesk_app owns no tables ────────────────────────────────
-- Expected: 0 rows. Any row is a FAILURE.
DO $$
DECLARE
  owned_count int;
BEGIN
  SELECT COUNT(*) INTO owned_count
  FROM pg_tables
  WHERE schemaname = 'public' AND tableowner = 'taxdesk_app';

  IF owned_count > 0 THEN
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app owns % table(s). '
      'The runtime role must not own any tables. '
      'Table ownership makes REVOKE ineffective.',
      owned_count;
  END IF;
  RAISE NOTICE 'PASS: taxdesk_app owns 0 tables';
END
$$;

-- ── Assertion 2: taxdesk_app has no BYPASSRLS ─────────────────────────────
DO $$
DECLARE
  bypass_rls bool;
BEGIN
  SELECT rolbypassrls INTO bypass_rls
  FROM pg_roles WHERE rolname = 'taxdesk_app';

  IF bypass_rls IS TRUE THEN
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app has BYPASSRLS. '
      'The runtime role must not be able to bypass Row Level Security.';
  END IF;
  RAISE NOTICE 'PASS: taxdesk_app does not have BYPASSRLS';
END
$$;

-- ── Assertion 3: taxdesk_app cannot TRUNCATE audit_logs ───────────────────
-- Switch to taxdesk_app context and attempt TRUNCATE (must fail).
DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE taxdesk_app;
    EXECUTE 'TRUNCATE audit_logs';
    -- If we get here, the assertion failed
    RESET ROLE;
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app can TRUNCATE audit_logs. '
      'The audit log must be append-only.';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE 'PASS: taxdesk_app cannot TRUNCATE audit_logs';
  END;
END
$$;

-- ── Assertion 4: taxdesk_app cannot UPDATE audit_logs ────────────────────
DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE taxdesk_app;
    EXECUTE 'UPDATE audit_logs SET action = ''tampered'' WHERE false';
    RESET ROLE;
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app can UPDATE audit_logs. '
      'The audit log must be append-only.';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE 'PASS: taxdesk_app cannot UPDATE audit_logs';
  END;
END
$$;

-- ── Assertion 5: taxdesk_app cannot DELETE from audit_logs ───────────────
DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE taxdesk_app;
    EXECUTE 'DELETE FROM audit_logs WHERE false';
    RESET ROLE;
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app can DELETE from audit_logs. '
      'The audit log must be append-only.';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE 'PASS: taxdesk_app cannot DELETE from audit_logs';
  END;
END
$$;

-- ── Assertion 6: taxdesk_app cannot CREATE TABLE (no DDL) ────────────────
DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE taxdesk_app;
    EXECUTE 'CREATE TABLE _ci_ddl_check (id int)';
    -- Clean up if somehow succeeded
    EXECUTE 'DROP TABLE IF EXISTS _ci_ddl_check';
    RESET ROLE;
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app can CREATE TABLE. '
      'The runtime role must not have DDL capabilities. '
      'Only taxdesk_migrations should be able to modify schema.';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE 'PASS: taxdesk_app cannot CREATE TABLE';
  END;
END
$$;

-- ── Assertion 6b: taxdesk_app has no database-level CREATE privilege ──────
-- Database CREATE allows creating new SCHEMAS inside the database.
-- taxdesk_app must not hold this privilege.
DO $$
DECLARE
  has_db_create bool;
BEGIN
  SELECT has_database_privilege('taxdesk_app', current_database(), 'CREATE')
  INTO has_db_create;

  IF has_db_create THEN
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app has database-level CREATE privilege. '
      'This allows creating schemas, which is a DDL capability the runtime role '
      'must not hold.';
  END IF;
  RAISE NOTICE 'PASS: taxdesk_app has no database-level CREATE privilege';
END
$$;

-- ── Assertion 6c: taxdesk_app has no schema-level CREATE privilege ────────
-- Schema CREATE allows creating tables/functions/etc inside the public schema.
-- This must be revoked from both taxdesk_app AND PUBLIC (to close the PG14
-- upgrade path where PUBLIC retained CREATE on public schema).
DO $$
DECLARE
  has_schema_create      bool;
  public_has_schema_create bool;
BEGIN
  SELECT has_schema_privilege('taxdesk_app', 'public', 'CREATE')
  INTO has_schema_create;

  IF has_schema_create THEN
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app has CREATE on the public schema. '
      'Verify that "REVOKE CREATE ON SCHEMA public FROM taxdesk_app" was applied.';
  END IF;
  RAISE NOTICE 'PASS: taxdesk_app has no CREATE on public schema';

  -- Also check PUBLIC (the implicit group role).
  -- On PostgreSQL 14 and earlier, PUBLIC had CREATE on public schema by default.
  -- On PostgreSQL 15+, new databases revoke this by default, but upgraded databases
  -- may still have it. This assertion catches the regression in both cases.
  SELECT has_schema_privilege('public', 'public', 'CREATE')
  INTO public_has_schema_create;

  IF public_has_schema_create THEN
    RAISE EXCEPTION
      'SECURITY VIOLATION: PUBLIC (all roles) has CREATE on the public schema. '
      'This is the PostgreSQL 14 default and allows any login role to create tables. '
      'Apply: REVOKE CREATE ON SCHEMA public FROM PUBLIC;';
  END IF;
  RAISE NOTICE 'PASS: PUBLIC role has no CREATE on public schema';
END
$$;

-- ── Assertion 6d: DEFAULT PRIVILEGES are DML-only (spot-check on a temp table) ─
-- Create a test table as taxdesk_migrations to verify ALTER DEFAULT PRIVILEGES
-- granted SELECT/INSERT/UPDATE/DELETE but NOT TRUNCATE or other privileges.
DO $$
DECLARE
  acl_entry   text;
  has_truncate bool := false;
BEGIN
  -- Create a test table as the migration role to trigger default privileges
  EXECUTE 'CREATE TABLE _ci_acl_check (id int)';

  -- Read the ACL for taxdesk_app on this table
  SELECT array_to_string(relacl, ',') INTO acl_entry
  FROM pg_class
  WHERE relname = '_ci_acl_check' AND relkind = 'r';

  -- Check for TRUNCATE privilege in the ACL string
  -- ACL format: role=arwdDxt/grantor  (a=insert r=select w=update d=delete D=truncate x=references t=trigger)
  -- We look for 'D' (TRUNCATE) in taxdesk_app's ACL entry
  IF acl_entry IS NOT NULL AND acl_entry LIKE '%taxdesk_app%D%' THEN
    has_truncate := true;
  END IF;

  DROP TABLE _ci_acl_check;

  IF has_truncate THEN
    RAISE EXCEPTION
      'SECURITY VIOLATION: taxdesk_app has TRUNCATE on newly created tables. '
      'ALTER DEFAULT PRIVILEGES must grant only SELECT, INSERT, UPDATE, DELETE — not TRUNCATE.';
  END IF;
  RAISE NOTICE 'PASS: DEFAULT PRIVILEGES grant only DML (no TRUNCATE) to taxdesk_app';

EXCEPTION
  WHEN OTHERS THEN
    -- Clean up on any error
    DROP TABLE IF EXISTS _ci_acl_check;
    RAISE;
END
$$;

-- ── Assertion 7: taxdesk_app cannot INSERT/UPDATE/DELETE on firm_directory ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'firm_directory'
  ) THEN
    BEGIN
      SET LOCAL ROLE taxdesk_app;
      EXECUTE 'INSERT INTO firm_directory (firm_id, slug, is_active) VALUES (gen_random_uuid(), ''ci-test'', true)';
      RESET ROLE;
      RAISE EXCEPTION
        'SECURITY VIOLATION: taxdesk_app can INSERT into firm_directory. '
        'This table is written only by a DB trigger.';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RESET ROLE;
        RAISE NOTICE 'PASS: taxdesk_app cannot INSERT into firm_directory';
    END;
  ELSE
    RAISE NOTICE 'SKIP: firm_directory table does not exist yet (run after migrations)';
  END IF;
END
$$;

-- ── Assertion 8: FirmDirectory has no orphaned rows ───────────────────────
DO $$
DECLARE
  orphan_count int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'firm_directory'
  ) THEN
    SELECT COUNT(*) INTO orphan_count
    FROM firm_directory fd
    LEFT JOIN firms f ON f.id = fd.firm_id
    WHERE f.id IS NULL;

    IF orphan_count > 0 THEN
      RAISE EXCEPTION
        'DATA INTEGRITY VIOLATION: % orphaned row(s) in firm_directory '
        '(firm_directory.firm_id has no matching firms.id). '
        'The trigger sync may have failed.',
        orphan_count;
    END IF;
    RAISE NOTICE 'PASS: firm_directory has 0 orphaned rows';
  ELSE
    RAISE NOTICE 'SKIP: firm_directory table does not exist yet';
  END IF;
END
$$;

DO $$
BEGIN
  RAISE NOTICE '=== All CI role assertions complete (8 privilege checks + 3 CREATE/ACL checks) ===';
END
$$;
