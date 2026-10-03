-- =============================================================================
-- TaxDesk PK — PostgreSQL Initialization Script
-- Runs ONCE when the Docker container is first created.
--
-- Role model:
--   taxdesk_migrations  — owns all tables; used only by "prisma migrate".
--                         NEVER available to the running application.
--   taxdesk_app         — runtime role; no DDL; no BYPASSRLS; not a table owner.
--                         The only role the NestJS worker connects as.
--
-- This separation makes REVOKE effective: a REVOKE on a table that taxdesk_app
-- does NOT own is an absolute restriction. A role that owns a table implicitly
-- has all privileges and can circumvent a REVOKE.
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Migration role (table owner; DDL; never used at runtime) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taxdesk_migrations') THEN
    CREATE ROLE taxdesk_migrations WITH LOGIN PASSWORD 'taxdesk_migrations_dev' NOINHERIT;
  END IF;
END
$$;

-- Grant the migration role the ability to create objects in the database.
GRANT ALL PRIVILEGES ON DATABASE taxdesk_dev TO taxdesk_migrations;
GRANT USAGE, CREATE ON SCHEMA public TO taxdesk_migrations;

-- ── Runtime role (no DDL; no BYPASSRLS; not a table owner) ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    CREATE ROLE taxdesk_app WITH LOGIN PASSWORD 'taxdesk_dev' NOINHERIT;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE taxdesk_dev TO taxdesk_app;
GRANT USAGE ON SCHEMA public TO taxdesk_app;

-- Grant DML on all EXISTING tables (future tables handled by ALTER DEFAULT PRIVILEGES below).
-- Explicitly naming the four operations keeps the runtime role's privileges narrow;
-- never use GRANT ALL here, even though it would be more convenient.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taxdesk_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taxdesk_app;

-- Grant DML on all FUTURE tables created by taxdesk_migrations.
-- ALTER DEFAULT PRIVILEGES only affects objects created AFTER this statement and
-- only when the creating role matches the FOR ROLE clause. It does NOT retroactively
-- change existing objects. The explicit grants above cover existing tables.
-- Again: SELECT/INSERT/UPDATE/DELETE only — never GRANT ALL ON TABLES.
ALTER DEFAULT PRIVILEGES FOR ROLE taxdesk_migrations IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taxdesk_app;

ALTER DEFAULT PRIVILEGES FOR ROLE taxdesk_migrations IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO taxdesk_app;

-- ── Restricted tables: taxdesk_app has INSERT-only or SELECT-only ─────────────

-- audit_logs — append-only; taxdesk_app cannot modify or erase history.
-- Applied after migrations create the table; re-run in migration 002 as well
-- for belt-and-suspenders. The REVOKE is effective because taxdesk_app does
-- not own audit_logs (taxdesk_migrations owns it).
-- NOTE: Prisma migrate creates tables as the connected role. When using
--       DATABASE_MIGRATIONS_URL (taxdesk_migrations), it owns the tables.
--       This REVOKE is effective only after that ownership is established.
--       See: infra/postgres/migrations/001_role_restrictions.sql which
--       applies these REVOKEs after the first Prisma migration runs.

-- firm_directory — written only by a DB trigger; taxdesk_app has SELECT only.
-- Same note as above — applied in the post-migration SQL file.

-- ── Explicit DDL denial for taxdesk_app and PUBLIC ──────────────────────────
-- PostgreSQL 15+ restricts CREATE on public schema by default for new databases,
-- but databases upgraded from PG 14 or earlier may retain the old permissive
-- default. Explicitly revoke to be safe regardless of version or migration path.
--
-- 1. Revoke CREATE from PUBLIC (the implicit group that includes all roles).
--    Without this, any role — including taxdesk_app — could gain CREATE through
--    PUBLIC's privileges on upgraded databases.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- 2. Revoke CREATE from taxdesk_app explicitly (defence-in-depth).
--    Even if PUBLIC retains CREATE in some edge case, taxdesk_app is explicitly denied.
REVOKE CREATE ON SCHEMA public FROM taxdesk_app;

-- The runtime role's only access to schema objects is:
--   USAGE (required to reference objects) + SELECT/INSERT/UPDATE/DELETE (DML only).
-- No DDL: no CREATE TABLE, CREATE SCHEMA, ALTER TABLE, DROP, or CREATE POLICY.
--
-- CI assertions (in ci-assert-roles.sql) verify:
--   has_database_privilege('taxdesk_app', current_database(), 'CREATE') = false
--   has_schema_privilege('taxdesk_app', 'public', 'CREATE') = false
--   Attempting CREATE TABLE as taxdesk_app raises insufficient_privilege

-- ── Explicit BYPASSRLS denial (belt-and-suspenders) ──────────────────────────
-- taxdesk_app is created with NOINHERIT and without BYPASSRLS.
-- Confirm by querying: SELECT rolbypassrls FROM pg_roles WHERE rolname = 'taxdesk_app';
-- Must return 'f'.

-- ── Summary of role capabilities ─────────────────────────────────────────────
-- taxdesk_migrations: LOGIN, NOINHERIT, ALL ON DATABASE, owns tables via Prisma migrate
-- taxdesk_app:        LOGIN, NOINHERIT, CONNECT + USAGE + SELECT/INSERT/UPDATE/DELETE only
--                     no CREATE on schema (denied for both taxdesk_app AND PUBLIC),
--                     no BYPASSRLS, not a table owner
