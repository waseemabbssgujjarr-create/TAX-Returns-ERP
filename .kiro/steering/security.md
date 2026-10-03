---
inclusion: always
---

# TaxDesk PK — Security Standards

## Multi-Tenancy & Data Isolation

- Every database query **must** be scoped by `firmId`.
- Enforce with **Postgres Row-Level Security (RLS)** policies on every table containing firm or client data.
- Write an integration test for every RLS policy that attempts a cross-firm read and asserts it returns zero rows.
- The application user connecting to Postgres must not have `BYPASSRLS` privileges in production.
- Client portal users are additionally scoped by `clientId` — they must never see another client's data within the same
  firm.

## Sensitive Field Handling

Fields requiring encryption at rest (envelope encryption using a per-firm data key wrapped by a KMS master key):

- CNIC / NTN (all stored variants)
- Full bank account numbers
- IBAN
- IRIS credentials (preferred: never store; if unavoidable, treat as highest-sensitivity)
- Any government ID number

Display masking rules:

- CNIC: `35202-*******-1` — reveal only on explicit click, logged as an audit event.
- Account numbers: last 4 digits only by default.
- Passwords / secrets: never displayed after entry.

## Authentication & Session Security

- Email + password with **TOTP 2FA** mandatory for staff accounts.
- Optional phone OTP for clients (lower friction, lower risk).
- Sessions: short-lived JWT access tokens + rotating refresh tokens stored in `HttpOnly`, `Secure`, `SameSite=Strict`
  cookies. Never in `localStorage`.
- Session scoped to `firmId` at creation time — switching firms requires re-authentication.
- Brute-force protection: rate-limit login attempts per IP and per account; exponential back-off; account lock after N
  failures with email notification.
- Idle timeout: configurable per firm (default 30 min); warn at T-2 min.

## Role-Based Access Control

Roles: `Owner`, `Manager`, `Associate`, `Reviewer`, `Client`.

- Permissions are checked **server-side** on every API call — never rely solely on UI hiding.
- Per-client access lists (`ClientAccess`) allow restricting which staff see which clients.
- Owner can edit the permissions matrix; changes are audit-logged.
- Never expose a role elevation endpoint without re-authentication.

## Document & File Security

- Virus/malware scan every uploaded file before any processing.
- Validate file type by **magic bytes**, not just extension.
- Enforce file size limits (configurable, default 25 MB per file).
- Store files in S3-compatible object storage with:
  - Server-side encryption (AES-256 or SSE-KMS).
  - No public access — only signed, time-limited URLs (default expiry 15 minutes).
  - Separate buckets / prefixes per firm.
- Delete temporary processing files immediately after use.
- Retain files per the configurable retention policy; hard-delete on client data deletion request.

## API Security

- All API endpoints require authentication unless explicitly public (login, health check).
- **CSRF protection** on all state-mutating endpoints (SameSite cookies + CSRF token for non-browser clients).
- **Strict Content Security Policy** (CSP): no inline scripts, restricted `connect-src`, report violations.
- Input validation with Zod on every API boundary — reject before processing.
- Rate limiting per IP and per authenticated user on all endpoints; stricter limits on auth, upload, and AI endpoints.
- Return RFC 7807 Problem Details JSON for errors — never expose stack traces or internal details.
- HTTP Strict Transport Security (HSTS) with preload in production.

## AI & Document Processing Security

- OpenAI API key stored in a secrets manager; injected as environment variable at runtime — never in the browser bundle,
  repo, or logs.
- Send only the **minimum necessary** document content to external AI services:
  - Mask CNIC, full account numbers, and addresses in payloads before dispatch; re-attach locally after extraction.
- Log every AI call: timestamp, `firmId`, document ID, model version, token count, cost — **not** the raw document
  content.
- Treat all content extracted from documents as **untrusted data**: validate through Zod schema before use; never
  execute or interpret as instructions.
- Per-client "AI off" switch: when enabled, no document content is sent to external services.
- Store client AI processing consent in the database; enforce before every AI call.

## Audit Log

- **Append-only** audit log table: no UPDATE or DELETE on this table by any application user.
- Every entry records: `firmId`, `userId`, `action`, `resourceType`, `resourceId`, `timestamp`, `ipAddress`,
  `userAgent`, `before` (JSON), `after` (JSON).
- Audit events include: login/logout, 2FA events, data read of sensitive fields, data create/update/delete, document
  upload/access/delete, computation run, AI call, role change, permission change, client portal approval, billing
  events.
- Audit log viewer in Admin is read-only with filtering by user, resource, date range, and action type.
- Export audit log as CSV for external review.

## Secrets & Environment

- All secrets via environment variables; never committed to the repo.
- `.env.example` with placeholder values only — no real values, no test credentials.
- Dependency scanning in CI (e.g., `npm audit`, Snyk, Dependabot) — block on critical vulnerabilities.
- SAST scan in CI on every PR.
- Periodic penetration testing before major releases.

## Backup & Recovery

- Automated daily database backups with tested restore procedure.
- Point-in-time recovery enabled on the production database.
- Backups encrypted at rest; stored in a separate region/account.
- Defined RTO and RPO targets documented and tested.
- Data retention and deletion workflow: firm owner can request full data export and deletion; deletion is logged and
  irreversible.

## Dependency Security

- Pin exact dependency versions in `package.json` (no open ranges in production dependencies).
- Review new dependencies for: maintenance status, download count, known vulnerabilities, licence compatibility.
- Flag any package name that could be a typosquatting variant before adding.
