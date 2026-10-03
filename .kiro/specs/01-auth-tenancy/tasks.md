# Spec 01 — Authentication, Tenancy & Roles: Tasks

**Status:** Ready for implementation.  
**Design reference:** `design.md` (APPROVED Round 2)  
**Requirements reference:** `requirements.md`

Build in the order listed. Each task has a **Definition of Done (DoD)** that includes the four reviewer-mandated
implementation constraints:

- **IC-1 (Atomic RLS transactions):** Multi-step DB operations that must be atomic share one `withRlsContext()` call. A
  nested `withRlsContext()` must reuse the active transaction, never silently open a new one.
- **IC-2 (Fail-closed RLS):** Missing context variables must result in zero rows, never unrestricted access.
- **IC-3 (Audit log integrity):** `audit_logs` has no `ON DELETE CASCADE`, `TRUNCATE` is revoked from `taxdesk_app`, and
  nullable FK references preserve historical events.
- **IC-4 (Encryption metadata):** Every encrypted field ciphertext blob includes nonce/IV, authentication tag, and
  key-version identifier to support rotation.

---

## Group 1 — Database Foundation

### Task 1.1 — Create the `taxdesk_migrations` and `taxdesk_app` database roles

**Why first:** All subsequent migration and runtime work depends on the correct role separation that makes `REVOKE`
effective.

**Steps:**

1. Add a `migrations` section to `infra/postgres/init.sql` that:
   - Creates `taxdesk_migrations` as the migration/owner role (used only by `prisma migrate`, never at runtime).
   - Creates `taxdesk_app` as the non-owner runtime role with no `SUPERUSER`, no `BYPASSRLS`, no table ownership.
   - Grants `taxdesk_app`: `CONNECT`, `USAGE ON SCHEMA public`, `SELECT/INSERT/UPDATE/DELETE` on all current and future
     tables via `ALTER DEFAULT PRIVILEGES`.
   - Revokes `UPDATE/DELETE` on `audit_logs` from `taxdesk_app`.
   - Revokes `INSERT/UPDATE/DELETE` on `firm_directory` from `taxdesk_app`.
   - Revokes `TRUNCATE` on `audit_logs` from `taxdesk_app`.
2. Update `docker-compose.yml` to use `taxdesk_migrations` for `prisma migrate` and `taxdesk_app` for the runtime
   `DATABASE_URL`.
3. Add separate env vars: `DATABASE_MIGRATIONS_URL` (uses `taxdesk_migrations`) and `DATABASE_URL` (uses `taxdesk_app`).
4. Update `.env.example` with both vars.

**DoD:**

- `SELECT tablename, tableowner FROM pg_tables WHERE tableowner = 'taxdesk_app'` returns zero rows.
- `taxdesk_app` cannot `UPDATE` or `DELETE` from `audit_logs` — assertion query in the migration test confirms this.
- `taxdesk_app` cannot `TRUNCATE` `audit_logs`.
- `taxdesk_app` cannot `INSERT/UPDATE/DELETE` on `firm_directory`.
- IC-3: audit log TRUNCATE revoked.
- **Migration credentials never become runtime credentials.** The separation is enforced structurally:
  - `DATABASE_MIGRATIONS_URL` uses `taxdesk_migrations` credentials and is only present in the CI/CD migration step and
    developer migration commands. It is never read by the NestJS worker at runtime.
  - `DATABASE_URL` uses `taxdesk_app` credentials and is the only DB connection string available to the running
    application.
  - The CI pipeline must assert that `taxdesk_app` cannot execute `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`, or
    `CREATE POLICY` — these DDL capabilities belong to `taxdesk_migrations` only.
  - A CI step runs: `psql $DATABASE_URL -c "CREATE TABLE _test_ddl_check (id int)"` and asserts it fails with a
    permission error. This verifies that even if `DATABASE_URL` were misconfigured to use the wrong role, the
    application could not alter the schema.
  - The `.env.example` documents the distinction with inline comments explaining which URL is for which role and that
    they must never be the same value in production.

---

### Task 1.2 — Prisma schema: core auth additions and `FirmDirectory`

**Steps:**

1. Add to `prisma/schema.prisma` exactly as specified in `design.md §2.1`:
   - `FirmDirectory` model (`firmId`, `slug`, `isActive`, `@@map("firm_directory")`).
   - `Firm` additions: `idleTimeoutMinutes Int @default(0)`, `encryptedDataKey String?`, relations `refreshTokens`,
     `otpCodes`.
   - `User` additions: `totpSetupPendingSecret String?`, `totpVerifiedAt DateTime?`, `lastActivityAt DateTime?`,
     `passwordChangedAt DateTime?`, relations `refreshTokens`, `recoveryCodes`.
   - `RefreshToken` model with all fields including `jwtFamily String`, indexes on `userId`, `firmId`, `jwtFamily`,
     `expiresAt`.
   - `RecoveryCode` model with index on `userId`.
   - `OtpCode` model with fields `contactHmac String`, `otpHash String`, compound index on `(firmId, contactHmac)`,
     index on `expiresAt`.
2. Run `pnpm prisma migrate dev --name auth-foundation` against the local Postgres (using `DATABASE_MIGRATIONS_URL`).
3. Verify migration file is generated and committed.

**DoD:**

- Migration applies cleanly on a fresh database.
- IC-3: `audit_logs` FK to `userId` is `SET NULL` on delete, FK to `firmId` is `RESTRICT`. Confirmed in migration SQL.
- `firm_directory` has no FK to `firms` at the DB level (it is maintained by trigger, not by Prisma FK cascade, to
  prevent accidental CASCADE delete of directory entries independently of trigger logic).
- `OtpCode.contactHmac` is the field name — not `contactHash`. Confirmed in generated Prisma client types.

---

### Task 1.3 — `FirmDirectory` sync trigger

**Steps:**

1. Create `infra/postgres/migrations/001_firm_directory_trigger.sql`:

   ```sql
   -- Insert into firm_directory when a firm is created
   CREATE OR REPLACE FUNCTION sync_firm_directory()
   RETURNS TRIGGER LANGUAGE plpgsql AS $$
   BEGIN
     IF TG_OP = 'INSERT' THEN
       INSERT INTO firm_directory (firm_id, slug, is_active)
       VALUES (NEW.id, NEW.slug, NEW.is_active);
     ELSIF TG_OP = 'UPDATE' THEN
       UPDATE firm_directory
       SET slug = NEW.slug, is_active = NEW.is_active
       WHERE firm_id = NEW.id;
     ELSIF TG_OP = 'DELETE' THEN
       DELETE FROM firm_directory WHERE firm_id = OLD.id;
     END IF;
     RETURN NULL;
   END;
   $$;

   CREATE TRIGGER trg_firm_directory_sync
   AFTER INSERT OR UPDATE OF slug, is_active OR DELETE ON firms
   FOR EACH ROW EXECUTE FUNCTION sync_firm_directory();
   ```

2. Apply via a Prisma custom migration (`prisma migrate dev --create-only`, then manually paste the SQL into the
   generated migration file before running it).
3. Write an integration test in `apps/worker/src/modules/auth/tests/firm-directory.integration.test.ts`:
   - **Create:** insert a `Firm` → assert `firm_directory` row exists with matching `firmId`, `slug`, `isActive`.
   - **Slug change:** update `firm.slug` → assert `firm_directory.slug` updated; old slug is gone.
   - **Deactivation:** update `firm.isActive = false` → assert `firm_directory.is_active = false`;
     `TenantBootstrapService.resolveFirm(slug)` returns null for this firm.
   - **Delete:** delete `Firm` → assert `firm_directory` row removed; no orphan remains.
   - **Duplicate slug prevention:** attempt to create a second firm with the same slug → DB unique constraint on
     `firm_directory.slug` prevents it.
   - **Orphan detection:** manually INSERT a `firm_directory` row with a non-existent `firmId` → a CI assertion query
     detects orphaned rows
     (`SELECT fd.firm_id FROM firm_directory fd LEFT JOIN firms f ON f.id = fd.firm_id WHERE f.id IS NULL` must return
     zero rows). Run this query in the CI pipeline after every migration.
   - **Directory is never an alternative source of truth:** `firm_directory` contains only `firmId`, `slug`, `isActive`.
     Any attempt by application code (outside the trigger) to write to it is blocked by the
     `REVOKE INSERT/UPDATE/DELETE` — verified by attempting a direct Prisma write and asserting a Postgres permission
     error.

**DoD:**

- All seven trigger integration test cases pass.
- Application code has no direct write to `firm_directory` — confirmed by ESLint rule (Task 2.3) and by the Postgres
  permission error test.
- Orphan detection query is a required CI step added in Task 7.2.
- `TenantBootstrapService.resolveFirm()` returns `null` for an inactive firm — verified by the deactivation test.

---

### Task 1.4 — PostgreSQL RLS policies

**Steps:**

1. Create `infra/postgres/migrations/002_rls_policies.sql` with the policies from `design.md §7.4`:
   - Enable RLS on all 11 tables.
   - `firm_directory`: open read policy `USING (true)`.
   - `firms`: strict isolation policy `USING (id = current_setting('app.current_firm_id', true)::uuid)`.
   - `users`, `clients`, `client_access`, `tax_year_files`, `documents`, `refresh_tokens`, `recovery_codes`,
     `otp_codes`, `audit_logs`: all with firm-scoped isolation policies.
   - Portal-specific `clients` policy scoped to `app.current_client_id` when `app.session_type = 'portal'`.
2. **Use `set_config()`, not raw `SET LOCAL` string interpolation.** All policy examples that set session variables in
   application code (the `withRlsContext` implementation in Task 2.3) must use:
   ```sql
   SELECT set_config('app.current_firm_id', $1, true)
   ```
   The `true` argument makes it transaction-local. This is parameter-safe and cannot be SQL-injected. Document this in a
   code comment at the call site.
3. Apply via Prisma custom migration.
4. Write RLS integration tests in `apps/worker/src/modules/auth/tests/rls.integration.test.ts`:

   For **every** tenant-scoped table, the test suite must cover **all five contexts**:

   - **Correct firm context:** `app.current_firm_id = firmA.id` → rows for firmA returned.
   - **Wrong firm context:** `app.current_firm_id = firmA.id` → zero rows from firmB.
   - **Missing firm context:** no `SET` at all → zero rows from any firm (IC-2, fail-closed).
   - **Portal — correct client context:** `session_type = 'portal'`, `current_client_id = clientA.id` → only clientA's
     data visible (for `clients` and any client-scoped tables).
   - **Portal — wrong client context:** `session_type = 'portal'`, `current_client_id = clientA.id` → zero rows for
     clientB's data.

   The missing-context test is the most critical: it verifies the system is fail-closed at the database layer.
   `current_setting('app.current_firm_id', true)` returning `NULL` must cause the policy `USING` clause to evaluate to
   false (not to true). This is the IC-2 guarantee.

**DoD:**

- All RLS integration tests pass against a real Postgres instance.
- IC-2: no-context query returns zero rows for every tenant-scoped table — verified by dedicated test assertions.
- `FORCE ROW LEVEL SECURITY` is set on tables (so even the table owner is subject to RLS when connecting as a
  non-superuser session). Add this to the migration.
- CI pipeline includes the RLS test suite; failures block the build.

---

## Group 2 — Backend Infrastructure

### Task 2.1 — `KeyManagementService` interface and `LocalKmsAdapter`

**Location:** `apps/worker/src/modules/kms/`

**Steps:**

1. Define the `KeyManagementService` interface in `apps/worker/src/modules/kms/kms.interface.ts` exactly as in
   `design.md §6.2`.
2. Implement `LocalKmsAdapter` in `apps/worker/src/modules/kms/local-kms.adapter.ts`:
   - Uses `crypto.createCipheriv('aes-256-gcm', ...)` / `createDecipheriv`.
   - Master key from `ENCRYPTION_MASTER_KEY` env var (32 bytes, base64-encoded); validated at startup.
   - **Ciphertext blob format (IC-4):** every encrypted value stored as a single base64 string encoding:
     ```
     version (1 byte) | IV (12 bytes) | authTag (16 bytes) | ciphertext (variable)
     ```
     `version = 0x01` for `LocalKmsAdapter`. The `ProductionKmsAdapter` will use `0x02`. The decryptor reads the version
     byte to select the correct algorithm/key-wrapping strategy. This makes ciphertext self-describing for rotation.
   - `generateDataKey()`: `crypto.randomBytes(32)` for plaintext; wrap it using the master key with the same AES-256-GCM
     scheme + version byte.
   - `unwrapDataKey(wrapped)`: decode version byte, decrypt.
   - `encryptWithDataKey(dataKey, plaintext)`: AES-256-GCM with a fresh 12-byte IV each call; return blob with version
     byte.
   - `decryptWithDataKey(dataKey, ciphertext)`: decode version byte, verify auth tag, return plaintext.
   - **Plaintext keys never leave the function scope.** Local variables only; no property assignment, no caching.
3. Create `KmsModule` that provides `KeyManagementService` via DI token `'KMS'`, binding `LocalKmsAdapter` for now.
4. Add `OTP_CONTACT_SECRET` env var (≥32 bytes, base64) to env validation schema and `.env.example`.
5. Write unit tests in `local-kms.adapter.test.ts`:
   - Round-trip: encrypt → decrypt returns original plaintext.
   - Different IVs: encrypting the same plaintext twice produces different ciphertexts.
   - Auth-tag tamper: modifying a byte in the ciphertext throws on decrypt.
   - Version byte: decoding version byte correctly identifies `0x01`.
   - Key rotation: ciphertext encrypted with old data key can be decrypted when given old data key; fails with wrong key
     (verifies IC-4 metadata works).

**DoD:**

- All unit tests pass.
- IC-4: every ciphertext blob includes version byte, IV, auth tag. Verified by unit test inspecting raw byte layout.
- Plaintext data keys never escape function scope — confirmed by code review checklist item in the PR template.
- `ENCRYPTION_MASTER_KEY` and `OTP_CONTACT_SECRET` validated at startup; missing key throws with a clear message before
  accepting any requests.

---

### Task 2.2 — `TenantBootstrapService`

**Location:** `apps/worker/src/modules/auth/tenant-bootstrap.service.ts`

**Steps:**

1. Create a dedicated `prismaBootstrap: PrismaClient` instance (not the shared Prisma service) that connects using
   `DATABASE_URL` (same `taxdesk_app` credentials — no privilege escalation).
2. Implement `resolveFirm(slug: string): Promise<{ firmId: string; idleTimeoutMinutes: number } | null>`:
   - Canonicalise: `slug.toLowerCase().trim()`. Validate format: `/^[a-z0-9-]{2,60}$/` — reject immediately if invalid
     (return null).
   - Query: `SELECT firm_id, is_active FROM firm_directory WHERE slug = $1` using `$queryRaw` with a parameterised query
     (not string interpolation).
   - If not found or `is_active = false`: return `null`. No error thrown — callers always receive a generic auth error.
   - If found: query `firms` for `idleTimeoutMinutes` using a separate `prismaBootstrap.$queryRaw` **after setting**
     `set_config('app.current_firm_id', firmId, true)` inside a short transaction. This is the only `firms` table access
     and it happens post-resolution with an RLS context.
3. `prismaBootstrap` must not be injectable into domain services (INV-4). It is used only inside
   `TenantBootstrapService`. Enforce via ESLint rule (see Task 2.3).
4. Unit tests with a mocked DB:
   - Invalid slug format → returns null immediately, no DB call.
   - Slug not found → returns null.
   - Inactive firm → returns null.
   - Valid slug → returns `{ firmId, idleTimeoutMinutes }`.

**DoD:**

- All queries use parameterised `$queryRaw`, never string interpolation.
- `prismaBootstrap` is only used in this file — ESLint rule (Task 2.3) enforces this.
- The function signature returns `null` for all failure cases; no information leaked through exception types.

---

### Task 2.3 — `PrismaRlsClient` and `RlsTransactionInterceptor`

**Location:** `apps/worker/src/database/`

**Steps:**

1. Implement `AsyncLocalStorage`-based identity store:

   ```typescript
   // apps/worker/src/database/rls-context.store.ts
   export interface RlsIdentity {
     firmId: string
     userId: string
     sessionType: 'staff' | 'portal'
     clientId?: string
   }
   export const rlsIdentityStorage = new AsyncLocalStorage<RlsIdentity>()
   ```

2. Implement `RlsTransactionInterceptor` (NestJS `NestInterceptor`):

   - Runs **after** `JwtAuthGuard` has resolved the user identity.
   - Extracts `{ firmId, userId, sessionType, clientId }` from `request.user`.
   - Calls `rlsIdentityStorage.run(identity, () => next.handle())` — stores identity in ALS for the duration of the
     request.
   - **Does not open any database transaction itself.** The interceptor only stores context. Transactions are opened on
     demand by `PrismaRlsClient.withRlsContext()`.

3. Implement `PrismaRlsClient` as a **request-scoped** NestJS provider:

   ```typescript
   async withRlsContext<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>
   ```

   - Reads identity from `rlsIdentityStorage.getStore()`. If null, throws
     `Error('INV-1 violated: no RLS identity context')`.
   - Opens `prisma.$transaction(async (tx) => { ... })`.
   - Inside the transaction, sets all session variables using `set_config()` (parameter-safe, not string interpolation):
     ```typescript
     await tx.$executeRaw`SELECT set_config('app.current_firm_id', ${identity.firmId}, true)`
     await tx.$executeRaw`SELECT set_config('app.current_user_id', ${identity.userId}, true)`
     await tx.$executeRaw`SELECT set_config('app.session_type', ${identity.sessionType}, true)`
     if (identity.clientId) {
       await tx.$executeRaw`SELECT set_config('app.current_client_id', ${identity.clientId}, true)`
     }
     ```
   - Calls `fn(tx)` and returns its result.
   - **Nested `withRlsContext()` reuse:** if `rlsIdentityStorage.getStore()` already has an active `tx` (tracked via a
     second ALS for the active transaction client), the nested call must reuse it, never open a second transaction. This
     prevents partial writes from independent nested transactions (IC-1).

4. Implement the **ESLint architecture rule** (INV-4):

   - Add a custom ESLint rule or use `no-restricted-imports` in `eslint.config.mjs` that blocks direct import of
     `PrismaService`/`PrismaClient`/`@prisma/client` from files in `apps/worker/src/modules/**` (domain modules).
   - Exception whitelist: `database/prisma-rls.client.ts`, `database/rls-context.store.ts`,
     `modules/auth/tenant-bootstrap.service.ts`.
   - Add a test that runs ESLint against a synthetic domain file that imports Prisma directly and asserts the rule
     fires.

5. Atomic transaction tests (IC-1):
   - Write a test that calls `withRlsContext` twice in sequence from the same request context and verifies they use
     separate transactions (each commits independently).
   - Write a test that calls `withRlsContext` from within an existing `withRlsContext` and verifies it reuses the outer
     transaction client.
   - Write a test that calls a service method outside any ALS context (no `rlsIdentityStorage.run(...)`) and verifies it
     throws `INV-1 violated`.

**DoD:**

- IC-1: nested `withRlsContext` reuses active transaction — verified by test.
- IC-1: multi-step atomic operations tested: `withRlsContext` containing user INSERT + audit_log INSERT succeeds
  atomically; if the second INSERT fails, the first is rolled back.
- IC-2: calling `withRlsContext` without ALS context throws synchronously — verified by test.
- INV-4: ESLint rule fires on any direct Prisma import in domain modules — verified by lint test.
- All session variables set via `set_config(key, value, true)` with parameterised values — no string interpolation in
  SET LOCAL calls.

---

### Task 2.4 — Auth module skeleton and global guard registration

**Steps:**

1. Create `apps/worker/src/modules/auth/auth.module.ts` importing `KmsModule`, `DatabaseModule` (which provides
   `PrismaRlsClient`), `JwtModule` (configured with `JWT_ACCESS_SECRET`, `expiresIn: '15m'`), `ThrottlerModule`
   (Redis-backed via `@nestjs/throttler`).
2. Register `JwtAuthGuard` as a global guard in `AppModule` using `APP_GUARD`.
3. Register `RolesGuard` as a global guard after `JwtAuthGuard`.
4. Register `RlsTransactionInterceptor` as a global interceptor via `APP_INTERCEPTOR`.
5. Create `@Public()` decorator, `@AllowPartialSession()` decorator, `@Roles(...roles)` decorator, `@CurrentUser()`
   param decorator.
6. Implement `JwtAuthGuard` enforcing (design.md §3.5):
   - Skips `@Public()` routes.
   - Validates HS256 signature (pin algorithm — no `alg: none`).
   - Checks `exp`, `isActive` (DB lookup), `passwordChangedAt > token.iat`.
   - Rejects `sessionState: 'partial'` unless route has `@AllowPartialSession`.
   - Returns 401 Problem Details on any failure — never reveals which check failed.
7. Implement `RolesGuard` enforcing write-method denial for `REVIEWER`.
8. Implement `FirmGuard` with `@FirmIdFrom('param.firmId' | 'body.firmId')` metadata decorator:
   - Returns 404 (not 403) on mismatch.
   - Logs `auth.anomaly.cross_firm` audit event.
9. Add rate limiter decorators to the auth controller using `@Throttle()` per the limits in `design.md §5.7`.

**DoD:**

- A request to any protected route without a token returns 401.
- A request with a partial-session token to a non-partial-session-allowed route returns 401.
- A request with a valid token from `firmA` to a resource owned by `firmB` returns 404 and writes an audit log entry.
- `Reviewer` role denied `POST`, `PUT`, `PATCH`, `DELETE` unless explicitly allowed — verified by test.

---

## Group 3 — Authentication Flows

### Task 3.1 — `TokenService`: JWT and refresh token management

**Location:** `apps/worker/src/modules/auth/token.service.ts`

**Steps:**

1. `issuePartialJwt(userId, firmId, role, sessionType)`: signs JWT with `sessionState: 'partial'`, generates a unique
   `jti`, returns `{ accessToken, jti }`.
2. `issueFullJwt(userId, firmId, role, sessionType, clientId?)`: signs JWT with `sessionState: 'full'`.
3. `issueRefreshToken(userId, firmId, jwtFamily, ipAddress, userAgent)`:
   - Generates 32 random bytes → opaque token value.
   - SHA-256 hashes the value → `tokenHash`.
   - Inserts `RefreshToken` row via `PrismaRlsClient.withRlsContext()`.
   - Returns the raw token value (to be set in the cookie) and the DB record ID.
4. `rotateRefreshToken(rawToken, ipAddress, userAgent)`:
   - SHA-256 hash the incoming token.
   - Look up `RefreshToken` by `tokenHash` **using `TenantBootstrapService` for the initial firm lookup, then
     `withRlsContext` for the token lookup**.
   - If found with `revokedAt` already set: **replay detected** — revoke all tokens in the same `jwtFamily` via a single
     `withRlsContext` call (IC-1: one atomic transaction for all revocations). Throw `ReplayAttackError`.
   - If not found or `expiresAt` past: throw `InvalidRefreshTokenError`.
   - Inside one `withRlsContext` call (IC-1): revoke old record, insert new record. Return new raw token value.
5. `revokeRefreshToken(rawToken)`: set `revokedAt = now` inside `withRlsContext`.
6. `revokeAllRefreshTokens(userId)`: revoke all `RefreshToken` rows for a user inside one `withRlsContext` call (IC-1).
7. Unit tests for all paths including replay detection and family revocation.

   The test suite for `rotateRefreshToken` must cover all six cases:

   - **Normal rotation:** valid token → new token issued, old token revoked, cookie updated.
   - **Replay detection:** token presented after already being rotated → entire `jwtFamily` revoked, 401 returned.
   - **Concurrent refresh:** two simultaneous calls with the same token → exactly one succeeds; the other receives a 401
     or 429 (not a spurious family invalidation). The chosen locking strategy (advisory lock or `SELECT … FOR UPDATE`)
     is tested.
   - **Family invalidation:** after replay, all sibling tokens in the same `jwtFamily` are revoked — verified by
     querying the DB for the family.
   - **Revoked token:** a token with `revokedAt` already set → 401, no new token issued.
   - **Expired token:** a token past `expiresAt` → 401, no new token issued.

**DoD:**

- IC-1: family revocation (all tokens for a `jwtFamily`) happens in a single `withRlsContext` call — verified by test
  asserting the mock transaction receives all revocations in one call.
- Refresh token raw value is never stored in the DB — only the SHA-256 hash. Verified by test asserting the DB record
  has `tokenHash ≠ rawToken`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are validated present at module load time.
- **Concurrent refresh:** the implementation must handle two simultaneous requests presenting the same refresh token
  (e.g. two browser tabs racing on page load). The database lookup + revoke + insert sequence must use a Postgres
  advisory lock or a `SELECT … FOR UPDATE` to serialise concurrent rotation. Accepted behaviour: the first request
  succeeds and rotates; the second request, presenting the same now-revoked token, triggers replay-family invalidation.
  Test with two concurrent calls: assert exactly one new token is issued and the other call receives 401. Verify the
  family is not spuriously revoked when the race is from the legitimate client (i.e. the lock prevents the second call
  from seeing the token as already-revoked — the losing request should retry against the newly-issued token, or receive
  a retriable 429 rather than triggering full-family invalidation).

  The resolution strategy must be documented in a code comment at the rotation call site.

---

### Task 3.2 — `AuthService`: login flow

**Location:** `apps/worker/src/modules/auth/auth.service.ts`

**Steps:**

1. Implement `login(dto: LoginDto, meta: RequestMeta)` exactly per `design.md §3.4`:
   - `TenantBootstrapService.resolveFirm(firmSlug)` — if null, apply constant-time delay, return generic 401.
   - Open `withRlsContext` to load user by `(firmId, email)`.
   - If not found: `bcrypt.compare(password, DUMMY_HASH)` for timing equalisation; return generic 401.
   - Check `lockedUntil` — if in future: return generic 401. (Do not reveal lock status.)
   - `bcrypt.compare(password, user.passwordHash)` — cost **12** (not 10 as mentioned for recovery codes; bcrypt cost
     must be 12 for passwords).
   - On fail: increment `failedLoginCount`; if ≥ 3 set `lockedUntil = now + 30min`, enqueue lock-notification email;
     write audit log — all inside **one `withRlsContext` call** (IC-1).
   - On success: reset `failedLoginCount` inside same `withRlsContext`.
   - Issue partial JWT. Return `{ accessToken, requiresTotpSetup: true }` or `{ accessToken, requiresTotp: true }`.
2. Write unit tests with mocked DB and bcrypt:
   - Generic 401 for unknown firm.
   - Generic 401 for unknown user (bcrypt still runs).
   - Generic 401 for wrong password.
   - Generic 401 for locked account.
   - `requiresTotpSetup: true` when `totpEnabled = false`.
   - `requiresTotp: true` when `totpEnabled = true`.
   - Lock triggers after 3rd failure.

**DoD:**

- IC-1: `failedLoginCount` increment + `lockedUntil` set + audit log INSERT all happen inside one `withRlsContext` call
  — verified by test.
- All failure cases return identical error text `"Invalid credentials."` — no branching on error message content.
- bcrypt cost 12 for password comparison — asserted in test by confirming the mock is called with the right hash
  parameters.

---

### Task 3.3 — `TotpService`: TOTP enrollment, verification, and recovery

**Location:** `apps/worker/src/modules/auth/totp.service.ts`

**Steps:**

1. `initiateSetup(userId, firmId)`:

   - Generate 20 random bytes → base32 secret using `otplib`.
   - Load firm's `encryptedDataKey` from `firms` table via `withRlsContext`.
   - `KMS.unwrapDataKey(encryptedDataKey)` → `dataKey`.
   - `KMS.encryptWithDataKey(dataKey, Buffer.from(secret))` → ciphertext with version byte + IV + authTag (IC-4).
   - Store ciphertext in `User.totpSetupPendingSecret` via `withRlsContext`.
   - Discard `dataKey` and plaintext `secret` immediately.
   - Build `otpAuthUrl`, generate QR code PNG data URL via `qrcode.toDataURL` (server-side only).
   - Return `{ otpAuthUrl, qrCodeDataUrl, secretDisplayText }`. Never return the raw secret bytes.
   - Write `auth.totp.setup_started` audit log inside the same `withRlsContext` as the UPDATE (IC-1).

2. `confirmSetup(userId, firmId, code)`:

   - Load `totpSetupPendingSecret` via `withRlsContext`.
   - Decrypt via KMS (transient plaintext only).
   - `otplib.authenticator.verify({ token: code, secret, window: 1 })`.
   - On fail: increment TOTP attempt counter; if 5 consecutive failures → lock account. Return generic error.
   - On success, inside one `withRlsContext` call (IC-1):
     - Copy `totpSetupPendingSecret → totpSecret`; clear `totpSetupPendingSecret`.
     - Set `totpEnabled = true`, `totpVerifiedAt = now`.
     - Generate 10 recovery codes (`crypto.randomBytes(5).toString('hex').toUpperCase()`).
     - `bcrypt.hash(code, 10)` for each recovery code.
     - INSERT 10 `RecoveryCode` rows.
     - Write `auth.totp.setup_complete` audit log.
   - Return `{ recoveryCodes: string[] }` — shown once, never retrievable.

3. `verifyTotp(userId, firmId, code)`:

   - Load and decrypt `totpSecret` via KMS (transient only).
   - `otplib.authenticator.verify({ token: code, secret, window: 1 })`.
   - On fail: increment failure counter, account lock at 5. Return false.
   - On success: return true.

4. `verifyRecoveryCode(userId, firmId, rawCode)`:

   - Load unused `RecoveryCode` rows for `userId` via `withRlsContext`.
   - `bcrypt.compare(rawCode, each.codeHash)` — iterate all; rate limit 3 attempts / 15 min via Redis.
   - On match, inside one `withRlsContext` call (IC-1): mark `usedAt = now`, write audit log
     `auth.login.recovery_code_used`.
   - Return true on match, false on no match.

5. Unit tests covering all paths, KMS interactions mocked.

**DoD:**

- IC-1: confirmSetup writes secret, recovery codes, and audit log in one `withRlsContext` call.
- IC-4: `totpSecret` and `totpSetupPendingSecret` stored as ciphertext blobs with version byte, IV, authTag. Unit test
  inspects the raw stored value and asserts it is not plaintext base32.
- Plaintext TOTP secret never exits `TotpService` — no return value, no property, no log. Code review checklist item in
  PR template.
- QR code generation (`qrcode.toDataURL`) runs server-side only; `qrcode` is a worker dependency, not a web dependency.

---

### Task 3.4 — `OtpService`: portal OTP send and verify

**Location:** `apps/worker/src/modules/auth/otp.service.ts`

**Steps:**

1. `sendOtp(firmSlug, contact, channel, meta)`:

   - Canonicalise contact: lowercase, trim. Validate email format (Zod).
   - `contactHmac = createHmac('sha256', OTP_CONTACT_SECRET).update(normalised).digest('hex')`.
   - Resolve `firmId` via `TenantBootstrapService.resolveFirm(firmSlug)`.
   - Rate-limit check: COUNT active `OtpCode` rows for `(firmId, contactHmac)` in the last hour via `withRlsContext`. If
     ≥ 3: return 429 (no detail on why — enumeration protection).
   - Generate OTP: `crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')`.
   - `bcrypt.hash(otp, 10)` → `otpHash`.
   - Inside one `withRlsContext` call (IC-1): INSERT
     `OtpCode { firmId, contactHmac, channel, otpHash, expiresAt: now+10min }` + write `auth.otp.sent` audit log.
   - Call `NotificationProvider.sendEmail(contact, otp)` **outside** the transaction (network I/O must not hold the DB
     connection open).
   - **Always return the same response** regardless of whether the contact is registered:
     `{ message: "A code has been sent." }`.

2. `verifyOtp(firmSlug, contact, code, meta)`:

   - Resolve `firmId` via `TenantBootstrapService`.
   - `contactHmac = createHmac(...)`.
   - Via `withRlsContext`: SELECT latest active
     `OtpCode WHERE firmId = ? AND contactHmac = ? AND usedAt IS NULL AND expiresAt > now`.
   - `bcrypt.compare(code, record.otpHash)`.
   - On fail: inside one `withRlsContext` call (IC-1): INCREMENT `attempts`; if `attempts ≥ 3` set `usedAt = now`
     (invalidate); write `auth.otp.fail` audit log.
   - On success: inside one `withRlsContext` call: set `usedAt = now`; write `auth.otp.verified` audit log.
   - Resolve `clientId` from `ClientPortalAccess` by `contactHmac` (the mapping is populated in Spec 02; stub for now).
   - Issue portal JWT with `{ sessionType: 'portal', clientId, firmId, sessionState: 'full' }`.
   - Issue refresh token. Return `{ accessToken }` + set cookie.

3. Unit tests: same-response for unknown contact; rate-limit enforcement; attempts counter; invalidation at 3 attempts;
   OTP expiry.

   The OTP test suite must cover the complete lifecycle and all anti-replay cases:

   - **Generate → store → verify → consume:** successful OTP login end-to-end; after `usedAt` is set, a second verify
     call with the same code returns 401.
   - **Expiry:** OTP past `expiresAt` is rejected regardless of correctness.
   - **Attempt limit:** 3 wrong codes → OTP invalidated (`usedAt = now`); 4th attempt with the correct code is still
     rejected.
   - **Replacement by newer OTP:** if a second OTP is generated for the same `contactHmac` before the first expires, the
     lookup always uses the latest non-expired, non-used record. Old OTPs for the same contact become unreachable (they
     remain in DB until cleanup but are not selected by the query because the query orders by `createdAt DESC LIMIT 1`).
   - **Rate limiting:** 3 `otp/send` calls within an hour → 4th returns 429; response is identical to success (no
     information leaked about why).
   - **Contact normalisation:** `User@Example.Com` and `user@example.com` produce the same `contactHmac` — verified by
     test.
   - **HMAC lookup determinism:** same contact + same `OTP_CONTACT_SECRET` always produces the same `contactHmac` across
     independent calls — verified by test.
   - **Generic responses:** `otp/send` returns the same response body regardless of whether the contact is registered.
     `otp/verify` returns the same error body for wrong code, expired code, and attempt-limit exceeded — no branching on
     error message content that could reveal OTP state.

**DoD:**

- IC-1: OTP code INSERT and audit log in one `withRlsContext`.
- IC-1: fail increment + invalidation and audit log in one `withRlsContext`.
- `NotificationProvider.sendEmail()` called **after** the transaction closes — never inside the `withRlsContext` block
  (would hold DB connection during SMTP call).
- HMAC uses `OTP_CONTACT_SECRET` env var, not the KMS master key — these are separate secrets for separate purposes.
- **OTP anti-replay:** all eight test cases listed above (generate/verify/consume, expiry, attempt limit, replacement,
  rate limiting, normalisation, HMAC determinism, generic responses) pass as automated tests.
- A consumed OTP (`usedAt` set) can never be re-used — asserted by the consume-then-verify test.

---

### Task 3.5 — Auth controller endpoints

**Location:** `apps/worker/src/modules/auth/auth.controller.ts`

**Steps:**

1. Implement all endpoints from `design.md §3.2` with correct DTOs (Zod-validated via `ZodValidationPipe`):
   - `POST /auth/login` — calls `AuthService.login()`; returns token or redirect hint.
   - `POST /auth/totp/verify` — calls `TotpService.verifyTotp()` or `TotpService.verifyRecoveryCode()` based on body
     field present.
   - `POST /auth/totp/setup/initiate` — `@AllowPartialSession`.
   - `POST /auth/totp/setup/confirm` — `@AllowPartialSession`.
   - `POST /auth/totp/setup/complete` — `@AllowPartialSession`; issues full JWT on success.
   - `POST /auth/refresh` — calls `TokenService.rotateRefreshToken()`; reads cookie via `@Req()`.
   - `POST /auth/logout` — calls `TokenService.revokeRefreshToken()`; clears cookie.
   - `POST /auth/otp/send` — calls `OtpService.sendOtp()`.
   - `POST /auth/otp/verify` — calls `OtpService.verifyOtp()`.
   - `GET /auth/me` — returns `{ user: { id, name, role, firmId, totpEnabled }, firm: { name, idleTimeoutMinutes } }`.
   - `POST /auth/password-reset/request` — returns `501 Not Implemented` (stub).
2. Cookie helper: `setRefreshTokenCookie(res, token)` / `clearRefreshTokenCookie(res)` using the exact settings from
   `design.md §4.2`: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth`, `Max-Age=604800`.
3. All error responses use RFC 7807 Problem Details JSON. No stack traces.
4. E2E tests (Vitest + Supertest against the real NestJS app with a test DB):
   - Full login → TOTP verify → GET /auth/me flow.
   - Expired access token → POST /auth/refresh → new token.
   - Logout → POST /auth/refresh returns 401.
   - 3 failed logins → account locked → generic 401 on 4th attempt.

**DoD:**

- Refresh token cookie has all required attributes — asserted by E2E test reading the `Set-Cookie` header.
- All error responses are valid RFC 7807 — asserted by E2E tests checking `Content-Type: application/problem+json`.
- No `X-Powered-By` header, no stack traces in any response.
- `@Public()` routes accessible without token; all others return 401 without a valid token.

---

## Group 4 — Frontend Auth UI

### Task 4.1 — Auth route layout and shared components

**Location:** `apps/web/src/app/[locale]/(auth)/`

**Steps:**

1. Implement `AuthLayout` as specified in `design.md §8.2`:
   - `min-h-svh`, centered flex column, `bg-surface-subtle`.
   - `LanguageSwitcher` in top-right corner (uses logical CSS `inset-inline-end`).
   - Card: `max-w-sm`, `rounded-lg`, `shadow-md`, `bg-surface`, `px-6 py-8`.
   - `BrandMark` component: "TaxDesk PK" text in `text-primary font-bold`.
2. Create shared auth components in `apps/web/src/components/auth/`:
   - `ErrorBanner`: `role="alert"`, `aria-live="polite"`, red border + error icon, `aria-describedby` link to field.
   - `OtpInput`: `type="text"`, `inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength="6"`,
     `pattern="[0-9]{6}"`. Full-width on mobile. On error: red border; under `prefers-reduced-motion`: red border only
     (no shake animation).
   - `SubmitButton`: wraps `<Button>` from `@taxdesk/ui` with `isLoading` propagation and `aria-busy`.
   - `LanguageSwitcher`: `<button>` with `aria-label` from i18n; clicking toggles locale and navigates to the equivalent
     path in the new locale.
3. Add all i18n keys used in auth flows to `packages/i18n/src/locales/en.json` and `packages/i18n/src/locales/ur.json`
   (parity required; hook will enforce).

**DoD:**

- `LanguageSwitcher` tested: switching from `en` to `ur` sets `dir="rtl"` on `<html>`; switching back sets `dir="ltr"`.
- `ErrorBanner` announced by a screen reader immediately on render (`role="alert"` verified by axe-core test).
- `OtpInput` accepts paste of a 6-digit string and populates the field correctly.
- All text strings use i18n keys — no hard-coded English strings in components.

---

### Task 4.2 — `LoginPage`

**Location:** `apps/web/src/app/[locale]/(auth)/login/page.tsx`

**Steps:**

1. Implement the `LoginPage` component tree from `design.md §8.2`.
2. React Hook Form + Zod schema:
   ```typescript
   const LoginSchema = z.object({
     firmSlug: z
       .string()
       .min(2)
       .max(60)
       .regex(/^[a-z0-9-]+$/),
     email: z.string().email(),
     password: z.string().min(1),
   })
   ```
3. On submit: `POST /auth/login`. On success navigate to `/[locale]/2fa` or `/[locale]/2fa-setup` based on response.
4. Password field: `autocomplete="current-password"`. Visibility toggle button: `aria-label` updates with state.
5. `FirmSlugField`: normalise to lowercase on blur (`onChange` keeps raw, `onBlur` calls `setValue` with lowercased
   value).
6. `ForgotPasswordLink` → `/[locale]/auth/password-reset` (stub page returning "Coming soon").
7. Animations per `design.md §8.6`: card entrance 200 ms fade + 8 px slide; `prefers-reduced-motion` → instant.
8. Responsive: full-width card on `< 640px`, sticky submit above keyboard
   (`position: sticky; bottom: calc(env(safe-area-inset-bottom) + 16px)`).
9. Storybook story with states: idle, loading, error (invalid credentials), error (account locked).

**DoD:**

- axe-core passes in Storybook and in Playwright for all story states.
- Keyboard-only flow: Tab through all fields; Enter submits; error focused after failure.
- Works at 320 px, 768 px, 1440 px in LTR and RTL.
- Light, dark, and high-contrast themes verified in Storybook.
- `prefers-reduced-motion` Storybook story: no transform animation.

---

### Task 4.3 — `TotpVerifyPage` and `RecoveryCodePage`

**Location:** `apps/web/src/app/[locale]/(auth)/2fa/page.tsx` and `.../recover/page.tsx`

**Steps:**

1. `TotpVerifyPage`:
   - `OtpInput` (from Task 4.1) as the only input.
   - `RecoveryLink` → `/[locale]/auth/recover`.
   - `BackButton` with RTL-mirrored chevron.
   - On submit: `POST /auth/totp/verify { code }` with partial JWT in `Authorization: Bearer`.
   - On success: store full access token in Zustand; navigate to `/[locale]/dashboard`.
   - On error: clear OTP input, refocus it, show `ErrorBanner` with remaining attempts count.
2. `RecoveryCodePage`:
   - `RecoveryCodeInput`: `type="text"`, `maxlength="10"`, `autocomplete="off"`, `spellcheck="false"`,
     `pattern="[A-F0-9]{10}"`.
   - Auto-uppercase on input.
   - On submit: `POST /auth/totp/verify { recoveryCode }`.
   - `BackButton` → `/[locale]/auth/2fa`.
3. Both pages: redirect to `/[locale]/login` if no partial JWT in Zustand (guard against direct navigation).
4. Storybook stories for both.

**DoD:**

- After a TOTP failure, focus returns to the OTP input and content is cleared — verified by Playwright test.
- `RecoveryCodeInput` auto-uppercases input — verified by unit test.
- axe-core passes for both pages.

---

### Task 4.4 — `TotpSetupPage` (3-step wizard)

**Location:** `apps/web/src/app/[locale]/(auth)/2fa-setup/page.tsx`

**Steps:**

1. `StepIndicator`: 3 steps; `aria-current="step"` on active step; completed step shows check icon.
2. `ScanStep`:
   - Fetch QR data: `POST /auth/totp/setup/initiate` with partial JWT; display `qrCodeDataUrl` in
     `<img alt={t('auth.setup.qrAlt')}>`.
   - `ManualEntryAccordion` (Radix `Collapsible`): shows `secretDisplayText` in groups of 4 chars, monospace font,
     `user-select: all`.
   - `ContinueButton` → step 2.
3. `VerifyStep`:
   - `OtpInput` (reuse from Task 4.1).
   - On submit: `POST /auth/totp/setup/confirm { code }`.
   - On error: show attempts remaining; at 5 failures redirect to login with locked message.
   - On success → step 3.
4. `RecoveryCodesStep`:
   - Display 10 codes from response in a grid (2 cols on phone, 5 cols on tablet+, monospace).
   - `DownloadCodesButton`: creates a `Blob` of the codes as plain text, triggers browser download as
     `taxdesk-recovery-codes.txt`.
   - `CopyAllButton`: `navigator.clipboard.writeText(codes.join('\n'))`; icon morphs to ✓ for 1.5 s. **Recovery codes
     must not remain in component state after this step is completed.**
   - `AcknowledgeCheckbox`: `aria-required="true"`; `DoneButton` has `aria-disabled` until checked.
   - On Done: `POST /auth/totp/setup/complete`; store full JWT in Zustand; navigate to `/[locale]/dashboard`.
5. Step transitions: 200 ms cross-fade via Framer Motion; `prefers-reduced-motion` → instant.
6. On step change: focus moves to the step heading (`useEffect` + `ref.current.focus()`).
7. Storybook stories for each step.

**DoD:**

- Recovery codes are cleared from component state after the user navigates away from step 3 — verified by unit test
  inspecting state after navigation.
- QR code `<img>` has a non-empty `alt` from i18n — verified by axe-core.
- `DownloadCodesButton` works without mocking (verified in Playwright by asserting download was triggered).
- axe-core passes for all three steps.

---

### Task 4.5 — `PortalLoginPage`

**Location:** `apps/web/src/app/[locale]/(portal)/login/page.tsx`

**Steps:**

1. Phase 1 (contact entry):
   - `ContactInput`: `type="email"`, `autocomplete="email"`, `inputmode="email"`.
   - `SendOtpButton`: on click, calls `POST /auth/otp/send { firmSlug, contact, channel: 'email' }`.
   - `LanguageSwitcher` is the **first** interactive element (above the form) — especially important for Urdu-first
     users.
2. Phase 2 (OTP entry, shown after successful send):
   - `SuccessBanner` (not an error; uses success styling): "A code has been sent to your email."
   - `OtpInput`.
   - `TimerCountdown`: 60-second client-side countdown; shows "Resend in Xs". When reaches 0, activates `ResendLink`.
   - `ResendLink`: disabled (`aria-disabled`, pointer-events: none) until timer expires.
   - On submit: `POST /auth/otp/verify { firmSlug, contact, code }`.
   - On success: store portal JWT in Zustand; navigate to `/[locale]/portal/home`.
3. `FirmSlug` is injected from a URL query param or from a `portalConfig` endpoint — not entered by the client user
   (they just see the branded portal). The `firmSlug` lookup from URL must be validated server-side before rendering the
   page.
4. Both phases on same page (no route navigation between them); local state machine controls which phase is shown.
5. Storybook stories for both phases.

**DoD:**

- `LanguageSwitcher` is the first focusable element — verified by Playwright keyboard-focus test.
- `ResendLink` is non-interactive (aria-disabled) until countdown reaches 0 — verified by unit test.
- The same "A code has been sent" response is shown whether or not the contact is registered — UI never branches on
  server response content to reveal registration status.
- axe-core passes for both phases.

---

## Group 5 — Session Management and Guards

### Task 5.1 — Zustand auth store and token refresh

**Location:** `apps/web/src/stores/authStore.ts`

**Steps:**

1. Zustand store with:
   ```typescript
   interface AuthState {
     accessToken: string | null
     user: { id: string; name: string; role: UserRole; firmId: string } | null
     firm: { idleTimeoutMinutes: number } | null
     sessionState: 'unauthenticated' | 'partial' | 'full'
     setToken(token: string, parsed: JwtPayload): void
     clearToken(): void
   }
   ```
2. `accessToken` is **never written to `localStorage` or `sessionStorage`**. The store is in-memory only. Add an ESLint
   rule or explicit comment asserting this.
3. TanStack Query background refetch:
   `useQuery({ queryKey: ['auth', 'refresh'], queryFn: refreshToken, refetchInterval: 12 * 60 * 1000, refetchIntervalInBackground: true })`
   — refetches every 12 min (access token is 15 min; 12 min ensures refresh before expiry).
4. On page load (`layout.tsx` effect): call `POST /auth/refresh` immediately. If 401 with `reason: 'idle_timeout'`: show
   "Session expired" toast; redirect to login. If any other 401: redirect to login silently.
5. Idle-timeout warning modal: compute `estimatedExpiry = tokenIat + firm.idleTimeoutMinutes * 60`. At
   `estimatedExpiry - 120s`: show a `<dialog>` (Radix Dialog): "Your session will expire in 2 minutes. Stay signed in?".
   Primary action: call `GET /auth/me` (extends `lastActivityAt`). Secondary: sign out.
6. Tests: Zustand store unit tests for state transitions; Playwright test for idle timeout warning appearing at the
   right time (using fake timers).

**DoD:**

- `localStorage.getItem` and `sessionStorage.getItem` are never called with an auth token key — verified by Playwright
  test that mocks these APIs and asserts they are never written.
- Idle timeout modal appears at T-2 min — verified by Playwright with `page.clock.fastForward`.
- On a 401 `idle_timeout` response from `/auth/refresh`, "Session expired" toast is shown — verified by Playwright.
- **Hard-refresh (browser reload) session bootstrap is an explicit E2E acceptance test.** The sequence:

  1. User logs in successfully (full JWT in Zustand, refresh cookie set).
  2. `page.reload()` — destroys Zustand state; access token is gone.
  3. The app immediately calls `POST /auth/refresh` using the HttpOnly cookie.
  4. Worker validates the refresh token, rotates it, returns a new access token.
  5. Zustand is populated; user lands on the dashboard without being redirected to login.

  This test must use a real browser (Playwright Chromium) with real cookies — not a mocked fetch — so that the HttpOnly
  cookie persistence across reloads is verified at the browser level, not just in unit tests.

---

### Task 5.2 — Next.js middleware: route protection

**Location:** `apps/web/src/middleware.ts`

**Steps:**

1. Extend the existing `next-intl` middleware to add auth-presence checks:
   - If request is to a `(staff)` route and **no** `refresh_token` cookie is present: redirect to `/[locale]/login`.
   - If request is to a `(portal)` route and no cookie: redirect to `/[locale]/portal/login`.
   - The middleware checks only cookie **presence** (edge runtime cannot verify JWT signatures). Actual token validation
     happens server-side in the worker.
2. Protected routes for `(staff)`: everything under `/(staff)/`.
3. Public routes: `/(auth)/`, `/(portal)/login`, `/api/health`, `/_next/`.
4. Test: Playwright test asserting that a request to `/en/dashboard` without a cookie redirects to `/en/login`.

**DoD:**

- Direct navigation to `/en/dashboard` without a cookie redirects to `/en/login` — verified by Playwright.
- The middleware does not attempt JWT verification (edge-incompatible) — confirmed by code review.

---

## Group 6 — Audit Logging and Notification

### Task 6.1 — `AuditService`

**Location:** `apps/worker/src/modules/audit/audit.service.ts`

**Steps:**

1. Implement `AuditService.log(entry: AuditEntry)`:
   - Always uses `withRlsContext()`.
   - Uses Prisma `audit_logs.create()` — INSERT only.
   - Never throws on failure (fire-and-forget pattern with structured error log if the INSERT itself fails, so a failed
     audit write never breaks a user-facing request — but this must be monitored via observability).
2. Define `AuditEntry` type covering all fields from `design.md §2.1.6` audit catalogue.
3. Enforce the "safe fields" contract: the `AuditEntry` type uses a discriminated union per `action` string, ensuring
   that the `before`/`after` fields for sensitive actions (TOTP, OTP) have type `never` or an explicitly
   safe-fields-only type. This makes it a compile-time error to accidentally log a TOTP secret.
4. Add `AuditService` to `AppModule` as a globally available provider.

**DoD:**

- IC-3: `audit_logs` has no `ON DELETE CASCADE` FK relationships — confirmed by reading the migration SQL.
- IC-3: `taxdesk_app` has no `TRUNCATE` privilege on `audit_logs` — confirmed by the Task 1.1 migration and a
  post-migration assertion test.
- Discriminated-union `AuditEntry` type: attempting to log a `totpSecret` value produces a TypeScript compile error —
  verified by a type-level test using `@ts-expect-error`.
- `AuditService.log()` called within every auth flow that requires an audit event — verified by unit tests checking the
  mock was called with the correct `action`.

---

### Task 6.2 — `NotificationProvider` interface and email adapter

**Location:** `apps/worker/src/modules/notifications/`

**Steps:**

1. Define `NotificationProvider` interface:
   ```typescript
   interface NotificationProvider {
     sendEmail(to: string, subject: string, body: string): Promise<void>
     sendSms(to: string, body: string): Promise<void> // stub; throws NotImplementedError
   }
   ```
2. Implement `SmtpEmailAdapter` using `nodemailer` with config from env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
   `SMTP_PASS`, `EMAIL_FROM`).
3. Email templates (plain text + HTML) for:
   - Account locked notification: subject "TaxDesk PK — Account Locked", body with firm name and timestamp.
   - OTP delivery: subject "Your TaxDesk PK verification code", body with 6-digit code and 10-minute expiry.
4. Both templates available in English only for now (Urdu email templates deferred to Phase 2).
5. Register `NotificationModule` with `SmtpEmailAdapter` as the `NotificationProvider` implementation.
6. `WhatsAppAdapter` stub: always throws `NotImplementedError`. Registered but never called until Phase 2.
7. Unit tests with `nodemailer` mocked.

**DoD:**

- OTP email template does not include the contact address in the subject line (privacy).
- The raw OTP value is never logged — confirmed by unit test checking that the mock transport receives the OTP in the
  body but the structured logger never receives it.
- Local dev: MailHog (`localhost:8025`) receives test emails when running `docker compose up`.

---

## Group 7 — Hardening and Validation

### Task 7.1 — Full RLS + auth integration test suite

**Steps:**

1. Create `apps/worker/src/modules/auth/tests/auth.integration.test.ts` with E2E flows against a real test Postgres +
   Redis:
   - Full login → TOTP → access protected resource → refresh → logout cycle.
   - Cross-firm 404: authenticated as firmA, try to access firmB resource.
   - Portal login: OTP send → verify → access portal-scoped resource → assert firmB and clientB invisible.
   - Account lock: 3 wrong passwords → 4th returns 401 with no lockout disclosure.
   - Recovery code: use all 10 → attempt 11th → 401.
   - Replay attack: send same refresh token twice → second attempt returns 401; all tokens in family revoked.
   - Idle timeout: set `lastActivityAt = now - 31min`, call `/auth/refresh`, expect 401 `idle_timeout`.
   - **Concurrent refresh:** two simultaneous `POST /auth/refresh` calls with the same token (use `Promise.all`).
     Assert: exactly one 200 response with a new token; the other receives 401 or 429; the `jwtFamily` is not spuriously
     invalidated for the winning request.
   - **Hard-refresh session bootstrap** (Playwright E2E, not just unit): full login → `page.reload()` → assert user
     lands on dashboard without re-entering credentials → assert new access token is in Zustand (inspected via
     `page.evaluate`). This test uses a real Chromium browser with real cookies.
2. Extend `rls.integration.test.ts` (from Task 1.4) to cover all 11 tables with:
   - Same-firm visible.
   - Cross-firm invisible.
   - No-context returns zero rows (IC-2).
   - Portal session: only own `clientId` visible.

**DoD:**

- All integration tests pass in CI against the Docker Postgres instance.
- IC-2: no-context zero-rows test is a required test case, not optional.
- Replay attack test verifies entire `jwtFamily` is revoked — asserts all sibling tokens are also invalidated.

---

### Task 7.2 — ESLint rules, CI checks, and PR template

**Steps:**

1. Add to `eslint.config.mjs`:
   - `no-restricted-imports` rule blocking direct import of `@prisma/client` or `PrismaService` in
     `apps/worker/src/modules/**` files (exceptions: `database/prisma-rls.client.ts`,
     `modules/auth/tenant-bootstrap.service.ts`).
   - Custom rule or `no-restricted-syntax` that flags `localStorage.setItem` or `sessionStorage.setItem` in
     `apps/web/src/**` with a message pointing to the auth token storage policy.
2. Add to `.github/workflows/ci.yml`:
   - Step: `pnpm prisma migrate deploy` (using `DATABASE_MIGRATIONS_URL`) before tests.
   - Step: assert `taxdesk_app` owns no tables (psql query, must return zero rows).
   - Step: assert `taxdesk_app` cannot TRUNCATE `audit_logs` (attempt TRUNCATE, expect permission error).
   - Step: assert `taxdesk_app` cannot DDL (`CREATE TABLE _test_ddl_check`; expect permission error).
   - Step: orphan `firm_directory` check —
     `SELECT fd.firm_id FROM firm_directory fd LEFT JOIN firms f ON f.id = fd.firm_id WHERE f.id IS NULL` must return
     zero rows.
   - Step: run `rls.integration.test.ts` as a required gate.
   - Step: run `firm-directory.integration.test.ts` as a required gate.
3. Create `.github/pull_request_template.md` with checklist:
   - [ ] All tenant-scoped DB operations use `PrismaRlsClient.withRlsContext()`
   - [ ] Multi-step atomic operations share one `withRlsContext()` call (IC-1)
   - [ ] No plaintext TOTP secret stored, returned, or logged
   - [ ] No access token written to `localStorage` or `sessionStorage`
   - [ ] New audit log events added to the `AuditEntry` discriminated union
   - [ ] `en.json` and `ur.json` parity maintained for any new i18n keys
   - [ ] RLS integration tests updated for any new tenant-scoped tables

**DoD:**

- ESLint rule fires when a test file deliberately imports `PrismaService` in a domain module — CI catches this.
- CI step asserting no table ownership by `taxdesk_app` is present and runs on every push.
- CI step asserting `taxdesk_app` cannot perform DDL is present.
- CI orphan `firm_directory` check is present and runs on every push.
- PR template file committed.

---

### Task 7.3 — Final spec 01 acceptance gate

**Steps:**

1. Run the full Definition of Done checklist from `requirements.md §4`:
   - [ ] All EARS acceptance criteria pass as automated tests.
   - [ ] RLS integration tests: same-firm visible, cross-firm zero rows, missing-context zero rows (IC-2), portal
         correct-client visible, portal wrong-client zero rows.
   - [ ] TOTP setup, verification, and recovery code flows work end-to-end (E2E Playwright).
   - [ ] Audit log entries verified for all 21 events in §2.1.6.
   - [ ] Works at 320 px, 375 px, 768 px, 1024 px, 1440 px in LTR and RTL.
   - [ ] Light, dark, and high-contrast themes — Storybook visual regression passes.
   - [ ] Keyboard-only: full login + TOTP setup + recovery code flow navigable without mouse.
   - [ ] axe-core passes in CI for all auth pages and Storybook stories.
   - [ ] No hard-coded secrets; `.env.example` updated with all new vars including `DATABASE_MIGRATIONS_URL`.
   - [ ] Concurrent refresh token rotation tested and passing.
   - [ ] Hard-refresh session bootstrap E2E test passing in real Chromium.
   - [ ] `FirmDirectory` sync trigger — all seven test cases passing including orphan detection.
   - [ ] OTP anti-replay — all eight test cases passing.
   - [ ] Zero imports of `@taxdesk/tax-engine` or `@taxdesk/rules` in auth module.
   - [ ] `taxdesk_app` DDL prevention check passing in CI.
   - [ ] Passes lint, typecheck, and all existing tax engine golden tests without regressions.
2. Update `specs-index.md` to set spec 01 status to `Complete`.

**DoD for this task = DoD of the entire spec:**

- Zero ESLint errors or TypeScript errors.
- Zero axe-core violations on auth pages.
- All integration and E2E tests green in CI.
- **Zero dependency on `@taxdesk/tax-engine`, `@taxdesk/rules`, or any tax-rule data in the auth implementation.** This
  is verified by checking that neither package appears in `apps/worker/src/modules/auth/**` imports, and that no
  tax-year, slab, or deadline data is referenced anywhere in the auth module, its tests, or its fixtures. The auth spec
  is intentionally isolated from tax computation so that future tax-rule changes cannot affect authentication behaviour.
- `specs-index.md` updated; spec 02 is unblocked.

---

## Task Dependency Map

```
1.1 (DB roles)
  └─ 1.2 (schema)
       └─ 1.3 (trigger)
            └─ 1.4 (RLS policies)
                 └─ 2.1 (KMS)
                      └─ 2.2 (bootstrap)
                           └─ 2.3 (PrismaRlsClient)
                                └─ 2.4 (auth module skeleton)
                                     ├─ 3.1 (TokenService)
                                     │    └─ 3.2 (AuthService login)
                                     │         └─ 3.3 (TotpService)
                                     │              └─ 3.4 (OtpService)
                                     │                   └─ 3.5 (Controller)
                                     └─ 6.1 (AuditService) ──────────────────┐
                                          └─ 6.2 (NotificationProvider)      │
                                                                              │
4.1 (Auth UI shared) ──────────────────────────────────────────────────────  │
  ├─ 4.2 (LoginPage)                                                         │
  ├─ 4.3 (TotpVerifyPage + RecoveryCodePage)                                 │
  ├─ 4.4 (TotpSetupPage)                                                     │
  └─ 4.5 (PortalLoginPage)                                                   │
                                                                              │
5.1 (Zustand store + refresh) ─────────────────────────────────────────────  │
5.2 (Next.js middleware) ──────────────────────────────────────────────────  │
                                                                              │
7.1 (Integration test suite) ← all of Groups 1–6 ────────────────────────────┘
7.2 (ESLint + CI + PR template) ← parallel with Group 3 onward
7.3 (Acceptance gate) ← all tasks complete
```

---

## Environment Variables Added by This Spec

Add to `.env.example`:

```bash
# Auth — JWT
JWT_ACCESS_SECRET="CHANGE_ME_64_RANDOM_BYTES"
JWT_REFRESH_SECRET="CHANGE_ME_64_RANDOM_BYTES_DIFFERENT"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Auth — Database roles
#
# DATABASE_URL          → taxdesk_app (runtime, no DDL, no BYPASSRLS, not table owner)
#                         Used by the NestJS worker at runtime for all application queries.
#
# DATABASE_MIGRATIONS_URL → taxdesk_migrations (owner role, migrations only)
#                           Used ONLY by "prisma migrate" and migration CI steps.
#                           NEVER set this in the application runtime environment.
#                           These two values MUST be different credentials in production.
#
DATABASE_URL="postgresql://taxdesk_app:CHANGE_ME@localhost:5432/taxdesk_dev"
DATABASE_MIGRATIONS_URL="postgresql://taxdesk_migrations:CHANGE_ME@localhost:5432/taxdesk_dev"

# Encryption (KMS — LocalKmsAdapter for dev; replace with managed KMS in production)
# Must be 32 random bytes, base64-encoded.
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# In production: store in AWS Secrets Manager / HashiCorp Vault — NOT in a plain .env file.
ENCRYPTION_MASTER_KEY="CHANGE_ME_32_RANDOM_BYTES_BASE64"

# OTP contact HMAC secret (for portal login — separate from encryption master key)
# Must be 32+ random bytes, base64-encoded. Different value from ENCRYPTION_MASTER_KEY.
# Same storage security requirements as ENCRYPTION_MASTER_KEY.
OTP_CONTACT_SECRET="CHANGE_ME_32_RANDOM_BYTES_BASE64_DIFFERENT"
```
