# Spec 02 — Client & Practice CRM

**Status:** Draft — awaiting review and approval before design/tasks begin.  
**Phase:** 1 (MVP)  
**Depends on:** Spec 01 (Auth & Tenancy) — must be complete first.

Reference: `#[[file:docs/product-brief.md]]` §B-6.2 · `#[[file:.kiro/steering/ux-standards.md]]` ·
`#[[file:.kiro/steering/security.md]]`

---

## 1. Overview

The CRM is the central index of all clients managed by a firm. It provides create/edit/archive, duplicate detection,
global search, a Client 360 view, CSV bulk import, family/company linking, and an activity timeline. It is the entry
point to every tax year file, document, notice, and invoice for a client.

---

## 2. Acceptance Criteria (EARS format)

### 2.1 Client Record Management

- **WHEN** a staff user creates a new client **THEN** the system **SHALL** require: display name, client type, and at
  least one of (CNIC or NTN). All other fields are optional at creation.
- **WHEN** a staff user submits a CNIC **THEN** the system **SHALL** validate its format (13 digits, `XXXXX-XXXXXXX-X`)
  before saving.
- **WHEN** a staff user submits a CNIC or NTN that already exists within the firm **THEN** the system **SHALL** show a
  duplicate-detection warning with a link to the existing client before allowing save.
- **WHEN** a client is saved **THEN** the system **SHALL** store the CNIC and NTN encrypted at rest (envelope
  encryption) and display them masked (`35202-*******-1`) by default.
- **WHEN** a staff user archives a client **THEN** the system **SHALL** retain all data, remove the client from active
  lists, and require a confirmation dialog before archiving.
- **WHEN** a staff user attempts to permanently delete a client **THEN** the system **SHALL** require Owner-level
  permission and a typed-confirmation dialog, and **SHALL** log the deletion in the audit log.

### 2.2 Client 360 View

- **WHEN** a staff user opens a client **THEN** the system **SHALL** display a single-page summary containing: identity
  summary (name, CNIC masked, NTN masked, filer status, client type), open tax year files with status, recent documents,
  open notices, outstanding invoices, and an activity timeline.
- **WHEN** the client's ATL (Active Taxpayer List) filer status is unknown or stale (older than 30 days) **THEN** the
  system **SHALL** show a banner prompting staff to verify the status.
- **WHEN** a staff user adds a note to a client record **THEN** the system **SHALL** save it with the author's name and
  timestamp, and it **SHALL** appear in the activity timeline.
- **WHEN** a staff user links a client to a family member or related company **THEN** the system **SHALL** display the
  relationship on both records and allow navigation between them.

### 2.3 Global Search & Command Palette

- **WHEN** a staff user presses `Ctrl/Cmd+K` or `/` **THEN** the system **SHALL** open the command palette within 100
  ms.
- **WHEN** a staff user types in the command palette **THEN** the system **SHALL** return matching clients (by name,
  CNIC last 4, NTN), documents, notices, and quick actions within 300 ms, ranked by recency and relevance.
- **WHEN** a search result for a CNIC is shown **THEN** the system **SHALL** display only the last 4 digits (e.g.
  `****-*******-3`) — never the full value.
- **WHEN** a staff user selects a result **THEN** the system **SHALL** navigate to the corresponding page with a smooth
  page transition.

### 2.4 Clients List

- **WHEN** a staff user opens the Clients list **THEN** the system **SHALL** display clients scoped to their firm, with
  columns: name, client type, filer status, assigned associate, last activity, open tax year status.
- **WHEN** the list contains more than 100 clients **THEN** the system **SHALL** virtualize the rows to maintain 60 fps
  scrolling.
- **WHEN** a staff user applies a filter (e.g. "Missing wealth statement", "Filed", "Assigned to me") **THEN** the
  system **SHALL** update the list within 300 ms without a full page reload.
- **WHEN** a staff user selects multiple clients **THEN** the system **SHALL** offer bulk actions: assign associate,
  request documents, send reminder, change status — with a confirmation step before execution.
- **WHEN** the list is viewed on a phone **THEN** the system **SHALL** render as a card list with name, type, status
  badge, and a tap-to-open action; table columns **SHALL NOT** be visible.

### 2.5 Bulk Import

- **WHEN** a staff user uploads a CSV or Excel file for bulk client import **THEN** the system **SHALL** parse the file
  locally, display a column-mapping screen, and show a preview of the first 10 rows before any records are created.
- **WHEN** a bulk import row contains a duplicate CNIC or NTN **THEN** the system **SHALL** flag that row in the preview
  as a duplicate and skip it unless the user explicitly overrides.
- **WHEN** a bulk import is confirmed **THEN** the system **SHALL** create records in a single transaction; if any row
  fails validation after mapping **THEN** the system **SHALL** report per-row errors without aborting the entire import.
- **WHEN** a bulk import completes **THEN** the system **SHALL** show a summary: created, skipped (duplicate), failed
  (with reasons), and provide a downloadable error report.

### 2.6 Permissions & Audit

- **WHEN** a staff user views a client **THEN** the system **SHALL** verify they are listed in `ClientAccess` for that
  client; if not, return HTTP 404.
- **WHEN** any client field is created, updated, or deleted **THEN** the system **SHALL** write a before/after snapshot
  to the audit log.
- **WHEN** a staff user reveals a masked CNIC or NTN **THEN** the system **SHALL** log a `sensitive_field_view` audit
  event with the user ID, client ID, field name, timestamp, and IP address.

---

## 3. UX requirements

- Client 360 page: three-pane on desktop (sidebar nav | main detail | activity panel), single-column on phone with
  tabbed sections.
- Empty state for new firms: illustrated empty state with "Add your first client" primary action and an option to import
  from CSV.
- Skeleton loaders for all list and detail views.
- Unsaved changes warning before navigating away from the edit form.
- `G then C` keyboard shortcut navigates to the Clients list from anywhere in the staff app.
- All text strings go through the i18n layer (en + ur).

---

## 4. Out of scope for this spec

- Tax year file creation (Spec 04)
- Document requests (Spec 03)
- Billing/invoices (Spec 12)
- ATL status API integration (Phase 2)
- Client portal account creation (Spec 13)

---

## 5. Definition of Done

- All acceptance criteria pass as automated tests.
- Duplicate detection works for both CNIC and NTN.
- RLS: a staff user not in `ClientAccess` for a client gets zero results — verified by integration test.
- Audit log entries verified for: create, update, archive, delete, sensitive field view.
- Bulk import handles CSV and XLSX; errors are surfaced per-row.
- Works at 320 px, 768 px, 1440 px in LTR and RTL, light and dark.
- Keyboard accessible: full navigation without mouse; `Cmd+K` palette; `G C` shortcut.
- WCAG 2.2 AA — axe-core passes in CI; manual screen-reader pass.
- Passes lint, typecheck, and all existing tests without regressions.
