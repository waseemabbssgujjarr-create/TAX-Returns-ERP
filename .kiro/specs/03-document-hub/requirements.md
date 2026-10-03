# Spec 03 — Smart Document Hub

**Status:** Draft — awaiting review and approval before design/tasks begin.  
**Phase:** 1 (MVP) — upload, storage, OCR adapter, and review screen. AI extraction is the critical path to the
fast-return feature.  
**Depends on:** Spec 01 (Auth & Tenancy), Spec 02 (Client CRM).

Reference: `#[[file:docs/product-brief.md]]` §B-6.3 · §C (AI Document Import) · `#[[file:.kiro/steering/security.md]]` ·
`#[[file:.kiro/steering/tax-rules-policy.md]]`

---

## 1. Overview

The Document Hub is where every client document lands — from web drag-drop, mobile camera, email-in, or WhatsApp link —
and where AI-assisted extraction turns PDFs and images into structured, pre-filled tax data. Staff spend time reviewing,
not typing.

---

## 2. Acceptance Criteria (EARS format)

### 2.1 Upload & Security

- **WHEN** a user uploads a file **THEN** the system **SHALL** validate its type by magic bytes (not extension alone),
  check its size against the configured limit (default 25 MB), and reject unsupported types with a clear error message
  within 1 second.
- **WHEN** a file passes type and size checks **THEN** the system **SHALL** enqueue a virus/malware scan before any
  further processing; infected files **SHALL** be quarantined and the user notified.
- **WHEN** the same file (by SHA-256 hash) is uploaded again for the same client **THEN** the system **SHALL** warn the
  user of the duplicate and **SHALL NOT** create a second record unless the user explicitly confirms.
- **WHEN** a user uploads a password-protected PDF **THEN** the system **SHALL** prompt for the password in the browser,
  use it transiently for decryption, and **SHALL NOT** persist the password.
- **WHEN** a file upload is in progress on a weak connection and the connection drops **THEN** the system **SHALL**
  support resumable upload (chunked), allow the user to resume from the last successful chunk, and show a "Paused — tap
  to resume" state.
- **WHEN** a file is successfully uploaded **THEN** the system **SHALL** store it in S3-compatible storage with
  server-side encryption, scoped to the firm's prefix, and accessible only via signed, time-limited URLs (default 15 min
  expiry).

### 2.2 Document Processing Pipeline

- **WHEN** a supported file is uploaded **THEN** the system **SHALL** show processing progress through stages: Uploaded
  → Security Check → Reading → Classifying → Extracting → Ready, with a per-file progress indicator.
- **WHEN** a PDF contains a selectable text layer **THEN** the system **SHALL** extract text locally (no AI call) before
  attempting any AI-based extraction. AI is only invoked when the text layer is absent or insufficient.
- **WHEN** an Excel or CSV file is uploaded **THEN** the system **SHALL** parse it locally and propose a column mapping;
  the user **SHALL** confirm the mapping before any data is committed. The system **SHALL NOT** send the full data file
  to an external AI service — only the header row and up to 5 sample rows for mapping suggestions.
- **WHEN** AI extraction is required **THEN** the system **SHALL** verify that the client has AI processing consent
  before sending any content to an external service. If consent is absent or AI is disabled for that client **THEN** the
  system **SHALL** fall back to manual entry.
- **WHEN** the AI extraction job completes **THEN** the system **SHALL** validate the returned data against the document
  type's Zod schema and run deterministic validation rules (arithmetic checks, date range, CNIC/name identity check)
  before presenting results to the user.
- **WHEN** a document's name or CNIC does not match the selected client **THEN** the system **SHALL** block commit with
  a hard warning until the user confirms or reassigns the document to the correct client.

### 2.3 Extraction Review Screen

- **WHEN** extraction results are ready **THEN** the system **SHALL** display a split view: the source document (with
  zoom, pan, and page thumbnails) on one side, and extracted fields with confidence badges on the other.
- **WHEN** a field has confidence ≥ 0.90 (configurable threshold) **THEN** the system **SHALL** show a green "Verified"
  badge. Between 0.60 and 0.90 → amber "Needs review". Below 0.60 → red "Check this".
- **WHEN** a staff user clicks a field **THEN** the system **SHALL** scroll the document viewer to the source location
  and highlight the relevant text/region.
- **WHEN** a staff user presses `Tab` **THEN** focus **SHALL** advance to the next unverified field; `Enter` accepts it;
  `E` opens it for edit.
- **WHEN** all fields at or above the confidence threshold are reviewed **THEN** the "Accept all verified" button
  **SHALL** become active and accept those fields in a single action.
- **WHEN** a bank statement is displayed **THEN** the system **SHALL** show a virtualized, filterable transactions grid
  with columns: date, description, debit, credit, balance, category, confidence. Rows with balance continuity errors
  **SHALL** be highlighted red.
- **WHEN** the user commits an import **THEN** the system **SHALL** show an "impact preview" — exactly what entities
  will be created/updated in the tax file and the effect on the current tax payable figure — before the final
  confirmation.

### 2.4 Committing & Audit

- **WHEN** a user confirms an import **THEN** the system **SHALL** create all entities (income entries, withholding
  entries, assets, etc.) with links back to the source document and field locations, write an audit log entry, and
  trigger a recomputation of tax and the Return Readiness Score.
- **WHEN** a user reverts an import batch **THEN** the system **SHALL** remove all entities created by that batch in a
  single transaction and restore prior values; the revert **SHALL** itself be audit-logged.
- **WHEN** the same transaction appears in two different imported statements **THEN** the system **SHALL** detect the
  duplicate and warn before committing, preventing double-counting.

### 2.5 Document Request Checklist

- **WHEN** a tax year file is created for a client **THEN** the system **SHALL** auto-generate a document request
  checklist based on the client's type (e.g. salary certificate for salaried individuals, bank statements, withholding
  statements).
- **WHEN** a document is uploaded and classified **THEN** the system **SHALL** automatically tick the corresponding
  checklist item if the document type matches.
- **WHEN** a checklist item remains unchecked for more than the configured number of days **THEN** the system **SHALL**
  trigger a reminder to the client via their preferred channel (email / SMS / WhatsApp), subject to the firm's reminder
  schedule.

### 2.6 Privacy & AI Controls

- **WHEN** any document content is sent to an external AI service **THEN** the system **SHALL** mask CNIC numbers, full
  account numbers, and postal addresses in the payload before dispatch, and re-attach them locally after extraction.
- **WHEN** an AI call is made **THEN** the system **SHALL** log: timestamp, firmId, documentId, model name/version,
  token counts, estimated cost — **NOT** the raw document content.
- **WHEN** the AI provider is unavailable or rate-limited **THEN** the system **SHALL** queue the job with exponential
  backoff, notify the staff user of the delay, and allow manual data entry in the interim.
- **WHERE** a client has AI processing disabled **THEN** the system **SHALL NOT** send any of that client's document
  content to any external AI service under any circumstances.

### 2.7 Edge Cases

- Rotated or skewed images: pre-process with deskew before extraction; low-confidence result → human review queue.
- Multi-month statements split across multiple files: allow staff to group files into a single statement before
  processing.
- Foreign currency transactions: extract original currency and amount; prompt staff to provide PKR rate and date.
- Partial failures: if one page fails in a multi-page document, keep what succeeded, surface a clear "page X failed —
  retry or enter manually" message.
- Very large files (> 10 MB): show a progress bar with estimated time; processing is always background (non-blocking).

---

## 3. UX requirements

- Upload zone: full-width drop target with drag-over animation (dashed border + "Release to upload" label); mobile
  camera button prominent on phones.
- Per-file progress cards with stage labels and animated progress ring.
- Review screen: scanning-line animation over document while extracting; fields fill in sequentially (respects reduced
  motion — instant under reduced motion preference).
- Confidence badges animate to their final colour; count-up of "fields extracted" on completion.
- Mobile review: card-per-field layout with large accept/edit buttons.
- Undo toast (8 s) after "Accept all verified" with one-click rollback.
- Empty state for no documents: illustration + "Upload your first document" CTA.

---

## 4. Out of scope for this spec

- Full AI extraction for all document types (salary + bank statement first; others in Phase 2)
- Email-in and WhatsApp-in ingestion (Phase 2)
- Bulk folder drop matching multiple clients (Phase 2)
- Column mapping template persistence (Phase 2)

---

## 5. Definition of Done

- Upload pipeline end-to-end: magic-byte check → virus scan → dedup → classify → extract → review → commit.
- Text-layer PDFs extracted locally without an AI call (verified by mocking the AI adapter in tests).
- AI adapter interface (`AiExtractionProvider`) tested with a mock; real OpenAI call tested in a separate integration
  test suite (not in CI by default — needs `OPENAI_API_KEY`).
- Deterministic validation tests: balance continuity, arithmetic, date range, CNIC mismatch — all pass with golden
  fixtures.
- Review screen: split view, confidence badges, Tab/Enter/E keyboard flow, accept-all, impact preview — all working.
- Bank statement transactions grid: virtualised, filterable, balance errors highlighted.
- Commit creates entities + audit log + triggers recomputation.
- Revert removes all batch entities in one transaction + audit log.
- AI consent check enforced: test asserts zero AI calls when client AI is disabled.
- Works at 320 px, 768 px, 1440 px in LTR and RTL, light and dark.
- WCAG 2.2 AA — axe-core CI pass; manual keyboard-only E2E for the review flow.
- Passes lint, typecheck, and all existing tests without regressions.
