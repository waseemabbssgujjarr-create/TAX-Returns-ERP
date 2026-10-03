# Spec 01 — Authentication, Tenancy & Roles

**Status:** Draft — awaiting review and approval before design/tasks begin.  
**Phase:** 1 (MVP)  
**Build order:** First — all other features depend on auth context and firm scoping.

Reference: `#[[file:docs/product-brief.md]]` §B-6.1 · `#[[file:.kiro/steering/security.md]]` ·
`#[[file:.kiro/steering/tech.md]]`

---

## 1. Overview

Every user session must be scoped to a single firm. Staff (Owner, Manager, Associate, Reviewer) authenticate with
email + password + TOTP 2FA. Clients authenticate with passwordless phone/email OTP. All data access is enforced
server-side by Postgres RLS policies keyed on `firmId` and validated in every integration test.

---

## 2. Acceptance Criteria (EARS format)

### 2.1 Sign-in — Staff

- **WHEN** a staff user submits valid email and password **THEN** the system **SHALL** require completion of a second
  factor (TOTP code) before granting a session.
- **WHEN** a staff user submits a valid TOTP code **THEN** the system **SHALL** issue a short-lived JWT access token (15
  min) and a rotating refresh token stored in an `HttpOnly Secure SameSite=Strict` cookie scoped to the firm's domain,
  and **SHALL** record a `login` event in the audit log.
- **WHEN** a staff user submits an invalid password three or more times within 15 minutes **THEN** the system **SHALL**
  lock the account for 30 minutes and send a notification email to the account's address.
- **WHEN** a staff user's access token expires **THEN** the system **SHALL** silently refresh it using the refresh token
  without requiring re-authentication, provided the refresh token is valid and the session has not been idle for longer
  than the firm's configured timeout (default 30 min).
- **WHEN** a staff user's idle timeout expires **THEN** the system **SHALL** invalidate the session, display a "Session
  expired" message, and redirect to the login page.
- **IF** a staff account does not have TOTP enabled **THEN** the system **SHALL** force the user through a TOTP setup
  flow before granting access to any protected resource.

### 2.2 Sign-in — Client Portal

- **WHEN** a client user enters their registered phone number or email on the portal **THEN** the system **SHALL** send
  a one-time passcode via the configured channel (SMS or email) and **SHALL NOT** reveal whether the contact details are
  registered.
- **WHEN** a client user submits a valid OTP within its expiry window (10 min) **THEN** the system **SHALL** issue a
  session scoped to their `clientId` and `firmId` only.
- **WHEN** a client user's session is active **THEN** the system **SHALL** only expose data belonging to that specific
  client — never another client within the same firm.

### 2.3 Multi-Tenancy

- **WHEN** an authenticated user requests any resource **THEN** the system **SHALL** scope the query by `firmId` derived
  from the session token, enforced by Postgres RLS.
- **WHEN** a user attempts to access a resource belonging to a different firm **THEN** the system **SHALL** return HTTP
  404 (not 403, to avoid information leakage) and **SHALL** write a `cross_firm_access_attempt` entry to the audit log.
- **WHEN** a new firm is created **THEN** the system **SHALL** provision an isolated RLS policy context and a dedicated
  encryption data key for that firm's sensitive fields.

### 2.4 Role-Based Access Control

- **WHEN** a staff user makes an API request **THEN** the system **SHALL** check their role and the resource's
  permission requirements server-side on every request — client-side UI hiding is not sufficient.
- **WHEN** an Owner updates the permissions matrix **THEN** the system **SHALL** apply the change immediately, write an
  audit entry, and require re-authentication for the affected users' next sensitive action.
- **WHEN** a Reviewer-role user attempts a write operation (create/update/delete) on a core record **THEN** the system
  **SHALL** deny the request with HTTP 403.
- **WHEN** a staff user is not listed in `ClientAccess` for a given client **THEN** the system **SHALL** treat that
  client's records as non-existent for that user.

### 2.5 Session Security

- **WHEN** a user signs out **THEN** the system **SHALL** immediately revoke the refresh token server-side and clear
  session cookies.
- **WHEN** a new session is created **THEN** the system **SHALL** record IP address, user agent, and timestamp;
  anomalous sign-ins (new device or country) **SHALL** trigger an email notification to the account holder.
- **WHEN** a staff user's account is deactivated **THEN** the system **SHALL** revoke all active sessions immediately.
- **WHERE** any page displays a sensitive field (CNIC, account number) **THEN** the system **SHALL** render it masked by
  default; revealing it **SHALL** require a click and **SHALL** log a `sensitive_field_view` audit event.

### 2.6 Security & Infrastructure

- **WHEN** a request arrives at any protected API endpoint **THEN** the system **SHALL** validate the JWT signature,
  expiry, and `firmId` claim before processing.
- **WHEN** any authentication or session event occurs **THEN** the system **SHALL** write an immutable entry to the
  `AuditLog` table.
- **WHEN** a Postgres query runs in the application context **THEN** the runtime database user **SHALL NOT** have
  `BYPASSRLS` privileges, and the RLS policy **SHALL** be tested with a dedicated integration test that attempts a
  cross-firm read and asserts zero rows returned.

---

## 3. Out of scope for this spec

- Social/OAuth sign-in (post-MVP)
- SSO / SAML (Phase 3)
- Password reset flow details (separate ticket, but placeholder route required)
- WhatsApp OTP (Phase 2 — stub the `NotificationProvider` interface only)

---

## 4. Definition of Done

- All acceptance criteria above pass as automated tests.
- RLS integration tests cover: same-firm read (succeeds), cross-firm read (zero rows), client portal cross-client read
  (zero rows).
- TOTP setup, validation, and backup-code flows work end-to-end.
- Audit log entries verified for: login, logout, failed login, account lock, 2FA event, sensitive field view, cross-firm
  attempt, role change.
- Works at all breakpoints in LTR and RTL, light and dark themes.
- Keyboard and screen-reader accessible (WCAG 2.2 AA).
- No hard-coded secrets; `.env.example` updated with all new variables.
- Passes lint, typecheck, and all existing golden tests without regressions.
