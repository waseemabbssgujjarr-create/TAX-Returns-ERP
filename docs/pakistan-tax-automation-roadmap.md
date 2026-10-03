# Pakistan Tax Automation Roadmap — TaxDesk PK

> Working document. This is an engineering + product roadmap, not legal advice. Every tax rule, deadline, and FBR/IRIS
> procedural claim here must be verified against the current Finance Act, FBR notifications, and IRIS portal behaviour
> by a qualified tax professional before being relied upon. See `.kiro/steering/tax-rules-policy.md` for the binding
> rules policy (no hard-coded tax values, deterministic engine, golden test cases).

## 0. Status at a glance

TaxDesk PK already has a working practice-management + computation core (auth/tenancy, client CRM, document hub,
tax-year workspace, wealth statement, withholding reconciliation, a deterministic tax engine, return _preparation_ with
a review/approval workflow, and PDF export). What it does **not** have yet is the last mile: an honest, trackable bridge
from an approved internal draft to an actual FBR/IRIS submission. This document maps that gap and the plan to close it,
and records what Phase 3 of this task built as a first increment.

---

## 1. Vision

Let a Pakistani tax consultant run a client's entire yearly tax cycle — collect documents, build the income/wealth
picture, compute tax deterministically, reconcile withholding, prepare the return, get it reviewed and approved, and
either submit it to FBR/IRIS in a few clicks (once a real integration exists) or track a manual IRIS-portal filing — all
from one auditable, multi-tenant, bilingual (EN/UR) system. No fabricated "filed with FBR" states, ever: every status
the product shows must be true.

## 2. Pakistan IRIS reality (what we're integrating against)

- **IRIS** (`iris.fbr.gov.pk`) is FBR's web portal for income tax return e-filing, individual/AOP/company. Access is by
  username (CNIC/NTN/Reg. No.) + password, with device/PIN-style verification history. It is a **session-driven HTML
  portal**, not a documented public REST API, for the return-filing workflows that matter here (income tax returns,
  wealth statements, withholding statements).
- FBR/PRAL do expose some narrower machine interfaces for specific use cases (e.g. ATL/filer-status verification,
  sales-tax-related integrations for some taxpayers), but **no stable, generally available API for individual/AOP/
  company income tax return submission** is known to exist today. This can change — large taxpayers, software houses, or
  FBR itself may publish APIs in the future — so the architecture must not assume "manual portal forever."
- **Credential custody**: a firm acting on a client's behalf typically holds the client's IRIS credentials (or files
  under its own tax-practitioner access where permitted). This is a trust- and security-sensitive responsibility:
  credentials must never be stored in plaintext, must be scoped per firm+client, must be auditable, and the client's
  authorization to the firm must be explicit and recorded.
- **Practical consequence**: the only universally-available "integration" today is **staff files manually on IRIS**,
  using data/exports prepared by TaxDesk, and then **records the FBR acknowledgment/reference number** back into the
  system for tracking, deadline management, and audit. Anything beyond that (official API, RPA) is a strict upgrade
  layered behind the same adapter interface — never a replacement for the audit trail.

### IRIS integration strategy — phased

| Phase                          | Adapter                                                                          | What it does                                                                                                                                                                                                                                                                                                                                           | Status                                         |
| ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **P0 — Manual + tracked**      | `ManualIrisAdapter` (today: `channel=MANUAL_PORTAL` + `record-manual-reference`) | Staff exports the prepared return (worksheet/PDF) from TaxDesk, files by hand on IRIS, pastes the FBR ack/reference number back in. TaxDesk tracks status, deadlines, and audit history.                                                                                                                                                               | **Shipped in this task.**                      |
| **P1 — RPA/middleware bridge** | `RpaIrisAdapter`                                                                 | A licensed browser-automation or middleware vendor drives the IRIS portal using firm-held, encrypted credentials under an explicit per-client authorization record. Reduces manual re-typing without needing an FBR API. Requires security review, legal review of ToS/automation risk, and a human-in-the-loop confirmation step before final submit. | Planned — not started.                         |
| **P2 — Official API**          | `ApiIrisAdapter`                                                                 | If/when FBR or PRAL publish a supported submission API, implement against it directly. Preferred long-term path — removes RPA fragility.                                                                                                                                                                                                               | Planned — contingent on FBR publishing an API. |

All three phases implement the **same** `IrisSubmissionPort` interface (`submitReturn`, `fetchStatus`,
`syncCredentials`) defined in `apps/worker/src/integrations/iris/iris-submission.port.ts`, so the service layer, API,
and UI never change when the binding is swapped — only the DI registration in `IrisModule` changes (see
`docs/adr/001-provider-adapters.md`).

### Security & audit requirements for any future credential-holding adapter (P1/P2)

1. Per-client **authorization record** (who approved the firm filing on their behalf, when, scope) — not implemented
   yet; required before P1/P2 ship.
2. Credentials encrypted via the existing `KeyManagementService` (`modules/kms`), never stored in plaintext, never
   logged. Firm-scoped, not globally shared.
3. Every submission attempt is **audit-logged** (already true today via `AuditService` + `iris_filing.*` actions) with
   actor, timestamp, outcome, and (if available) the raw adapter response.
4. A **human confirmation step** before any adapter actually calls into FBR/IRIS — never a silent background filing.
5. Rate-limiting / backoff and a kill-switch per firm, since any portal-automation integration is inherently fragile
   against FBR-side changes.

---

## 3. Document taxonomy

`DocumentCategory` (Prisma enum, `packages/schemas/src/documents.ts`):

| Category                  | Used for                                                                                                             | Status                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `SALARY_CERTIFICATE`      | Salaried individual annual salary certificate                                                                        | Existing               |
| `BANK_STATEMENT`          | Bank statements for income/expense/wealth evidence                                                                   | Existing               |
| `WITHHOLDING_STATEMENT`   | Section-wise withholding tax certificates (salary, bank profit, utilities, vehicle, property, cash withdrawal, etc.) | Existing               |
| `PROPERTY_DOCUMENT`       | Property ownership/transaction documents                                                                             | Existing               |
| `INVESTMENT_STATEMENT`    | Brokerage/investment account statements                                                                              | Existing               |
| `WEALTH_STATEMENT`        | Wealth-statement-supporting documents (asset/liability evidence)                                                     | **Added in this task** |
| `OTHER` / `UNCATEGORIZED` | Everything else, triage queue                                                                                        | Existing               |

Document lifecycle is already modelled with `DocumentStatus`, `DocumentProcessingStatus`, `DocumentExtractionStatus`,
`DocumentReviewStatus`, versioning, and AI-assisted extraction (`modules/ai-extraction`, `modules/document-processor`).

**Gap / future work:** no category yet for AOP partnership deeds, company incorporation/Form-A documents, or NTN/CNIC
copies themselves as a first-class category. Add as client-type-driven requirements are built out (§8).

---

## 4. Data pipeline (today vs. target)

```
Ingest (upload) → OCR/AI extraction (optional) → Human verification → Tax-year sections → Compute → Wealth/Withholding
reconciliation → Return preparation (draft→review→approve) → [NEW] IRIS filing (prepare→submit/record→track) → Export
```

| Stage              | Implementation today                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingest             | `modules/documents` + `modules/storage` (MinIO/local), virus/magic-byte checks                                                                                                                  |
| Extract            | `modules/ai-extraction` (OpenAI adapter) + `modules/document-processor` pipeline, Zod-validated extraction schemas (`packages/schemas/src/extraction/*`)                                        |
| Validate           | Human review states (`DocumentReviewStatus`), provenance tags per workspace field (`DataProvenance`: editable/extracted/verified/calculated/draft_rules)                                        |
| Populate schedules | `TaxYearFile.sections` (JSON, keyed by `TaxYearSectionKey`), wealth statement, withholding entries                                                                                              |
| Compute            | `packages/tax-engine` — pure function over `packages/rules/<taxYear>/*`, versioned, fail-closed on missing/draft rules                                                                          |
| Reconcile          | `withholding-reconciliation.util.ts`, `wealth-reconciliation.util.ts`                                                                                                                           |
| Prepare return     | `ReturnPreparationService` — assembles a structured, versioned draft (`ReturnPrepDraftV1`), gates DRAFT→IN_REVIEW→APPROVED                                                                      |
| **File to IRIS**   | **New in this task** — `IrisFilingService` tracks DRAFT→READY→(PENDING_INTEGRATION / SUBMITTED)→(ACCEPTED/REJECTED), gated on an approved return prep + reconciled wealth/withholding checklist |
| Export             | `modules/export-generator` — PDF worksheet/summary/wealth statement artifacts (`FilingExportProvider` stub for IRIS_XML)                                                                        |

---

## 5. Return types

`ClientType` already models the taxpayer categories FBR cares about: `SALARIED_INDIVIDUAL`, `BUSINESS_INDIVIDUAL`,
`AOP_PARTNERSHIP`, `PRIVATE_LIMITED`, `PROPERTY_OWNER`, `OVERSEAS_PAKISTANI`, `FREELANCER_IT_EXPORTER`, `NON_PROFIT`.

**Gap:** the tax engine, rules library, and return-prep assembler do not yet branch logic per client type (e.g. AOP
profit-sharing schedules, company minimum-tax/super-tax schedules, presumptive-tax regimes for exporters). This is
primarily `packages/rules` + `packages/tax-engine` + `assemble-return-draft.util.ts` work, not a schema change — the
workspace/document/filing scaffolding built here is type-agnostic and should not need to change shape.

---

## 6. Submission workflow (what this task built)

A new, intentionally separate concept from `ReturnPreparation` (internal drafting/review) tracks the **external**
submission:

- **Prisma model**: `IrisFiling` (1:1 with `TaxYearFile`) — `status` (`IrisFilingStatus`:
  `DRAFT → READY → PENDING_INTEGRATION | SUBMITTED → ACCEPTED | REJECTED`, or `FAILED`), `channel`
  (`MANUAL_PORTAL | API`), `irisReferenceNo`, `responseJson`, `errorMessage`, `attemptCount`, `submittedAt/By`,
  `lastSyncedAt`.
- **Readiness checklist** (`filing-readiness.util.ts`): gates "ready to file" on (a) return preparation `APPROVED` with
  validation gate `approved_gate_ok`, (b) wealth statement `RECONCILED` + reviewer `APPROVED`, (c) withholding fully
  matched (warning-level), (d) at least one supporting document attached (warning-level). Error-level items block
  submission; warning-level items do not.
- **API** (`apps/worker/src/modules/tax-years/iris-filing.service.ts` + routes on `TaxYearsController`):
  - `GET /tax-years/:id/filing` — current state + live-recomputed readiness.
  - `POST /tax-years/:id/filing/prepare` — create/refresh the row and its status from current workspace state.
  - `POST /tax-years/:id/filing/submit` — attempt via `IrisSubmissionPort` (stub ⇒ `PENDING_INTEGRATION`, honest).
  - `POST /tax-years/:id/filing/record-manual-reference` — record a manual IRIS-portal filing's FBR ack number.
  - `POST /tax-years/:id/filing/refresh-status` — poll `IrisSubmissionPort.fetchStatus` for a submitted filing.
  - `GET /tax-years/:id/filing/activity` — audit trail (reuses `AuditLog` via `AuditService`, actions
    `iris_filing.prepare|submit_attempt|status_sync`).
- **UI**: `FilingSection` in the tax-year workspace (after Return Preparation) — status badge, checklist, an honest "no
  live integration" banner, a manual-reference recording form, and an activity timeline. Mirrors the existing
  `ReturnPreparationSection` / `WealthStatementSection` visual language (border-border cards, status pills, lucide
  icons, next-intl strings, EN+UR parity).
- **Admin → Integrations**: `IrisSubmissionPort` listed alongside the other provider adapters with a `stub` badge, per
  the existing adapter-status convention (`AdminIntegrationsClient`).

This is deliberately **not** wired into `FilingExportProvider` (`IRIS_XML` export format) — that remains a document
_export_ concern (what a human or RPA tool would upload/paste into IRIS), while `IrisSubmissionPort` is the _submission_
concern (did it actually reach FBR, and what did FBR say back).

---

## 7. Compliance calendar

`ComplianceEvent` (`kind`: `DEADLINE | REMINDER | INFO_REQUEST | FILING`) + `reminder-scheduler` module already exist
and are tax-year/client scoped. **Gap:** no seeded calendar of statutory Pakistan deadlines (income tax return filing
date — ordinarily 30 September for individuals/AOPs and later for companies depending on year-end, with FBR extension
notifications; advance tax instalment dates; withholding statement filing dates for withholding agents). This should be
modelled as **versioned data** (like tax rules — dates/extensions change yearly and by FBR notification), not
hard-coded, living under `packages/rules/<taxYear>/deadlines.json` (already specified in the rules policy) and surfaced
into `ComplianceEvent` rows per client/tax-year by a scheduled job. Not started.

---

## 8. Roles & permissions

Existing `UserRole`: `OWNER | MANAGER | ASSOCIATE | REVIEWER | CLIENT`. The new filing endpoints reuse this:

- `OWNER | MANAGER | ASSOCIATE` — prepare/refresh readiness, sync status.
- `OWNER | MANAGER | REVIEWER` — submit to IRIS / record a manual reference (same bar as `ReturnPreparation.approve`,
  since submission is the highest-stakes action in the pipeline).
- `CLIENT` (portal) — no filing-status visibility yet. **Gap/next step:** a read-only portal view of filing status (e.g.
  "Your return was filed on IRIS on {date}, reference {ref}") would close the loop for the client without exposing
  internal checklist detail.

---

## 9. Integration points (current + planned)

| System             | Today                                             | Planned                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FBR/IRIS           | None (stub adapter, manual-reference tracking)    | P1 RPA bridge, P2 official API if published                                                                                                                                                            |
| Object storage     | MinIO / local FS (`ObjectStorageProvider`) — live | —                                                                                                                                                                                                      |
| AI extraction      | OpenAI (`AiExtractionProvider`) — live            | Add provider-specific extraction schemas per document category as needed                                                                                                                               |
| Payments           | `PaymentProvider` stub                            | Local payment rail / Stripe-equivalent when billing goes live                                                                                                                                          |
| Banks              | None                                              | Open-banking-style statement import is **not generally available** in Pakistan for consumer tax use today; realistic near-term path remains document upload + OCR, not direct bank API pulls           |
| Payroll            | None                                              | Salary-certificate upload remains the practical ingestion path; payroll-system API integration is a per-employer custom integration, not a general product feature in the near term                    |
| ATL / filer-status | None                                              | A narrow, lower-risk integration target — FBR publishes an Active Taxpayer List lookup; a future adapter could auto-refresh `Client.filerStatus` without touching the harder return-submission problem |

---

## 10. Risks & legal

1. **Acting as an e-intermediary / attorney-in-fact on IRIS** carries real legal and professional-responsibility weight.
   The firm — not the software — remains legally responsible for what is filed (steering principle #7,
   `.kiro/steering/product.md`). The product must never create pressure to submit without human review and must keep
   `.disclaimerKey`/`filingDisclaimer` style guardrails (already present on `ReturnPrepDraftV1`) extended analogously
   onto filing confirmations.
2. **Credential custody risk** (P1/P2): storing/using client IRIS credentials, even encrypted, is a high-value target
   and a point of liability if the firm's access is misused or breached. Do not build P1/P2 without: KMS-backed
   encryption, per-client authorization records, strict audit logging, and a security review.
3. **Portal fragility** (P1 RPA path): IRIS is not a stable API; UI changes break automation silently. Any RPA adapter
   needs health checks, fast failure detection, and a manual fallback (P0) that is never removed.
4. **No hard-coded tax law.** Already enforced by `.kiro/steering/tax-rules-policy.md` and the pure `tax-engine` +
   `packages/rules` design; the filing layer built here adds no tax-rule logic, by design — it only tracks submission
   state.
5. **Data residency / privacy.** CNIC/NTN and financial data are already encrypted at rest (`cnicEncrypted` /
   `ntnEncrypted`, firm-scoped KMS). Any future adapter must not introduce a new unencrypted copy of this data (e.g. in
   adapter logs or `responseJson` — review before logging raw IRIS responses).

---

## 11. MVP vs v1 vs v2

| Milestone                                  | Scope                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MVP (this task + immediate follow-ups)** | Documents → review → compute → wealth/withholding reconciliation → return preparation (approve) → **honest filing tracking** (manual recording of IRIS submissions) → PDF exports. No real FBR API calls. _Shipped: schema, API, UI, adapter interface, docs._                       |
| **v1**                                     | Seeded compliance calendar from versioned deadline data; client-type-aware return assembly (AOP/company schedules); portal-visible filing status; `RpaIrisAdapter` behind a feature flag with explicit per-firm opt-in, security review complete, authorization records implemented. |
| **v2**                                     | `ApiIrisAdapter` if/when FBR publishes a supported API; ATL/filer-status auto-refresh; richer document-category coverage (NTN/CNIC, incorporation docs); ERP/payroll one-off integrations for specific large clients.                                                                |

---

## 12. What exists in the repo today vs. gaps (summary)

**Exists:** auth/tenancy + RLS, client CRM, document hub with AI extraction, tax-year workspace with provenance
tracking, deterministic tax engine + versioned rules loader, wealth statement reconciliation, withholding
reconciliation, return preparation with draft/review/approve + audit trail, PDF export generation, admin integrations
status page, EN/UR i18n with parity CI check.

**Built in this task:** `WEALTH_STATEMENT` document category; `IrisFiling` Prisma model + migration;
`IrisSubmissionPort` adapter interface + `StubIrisAdapter` + `IrisModule`; `IrisFilingService` with a pure
readiness-checklist util; filing API routes on `TaxYearsController`; `FilingSection` web UI wired into the tax-year
workspace; IRIS entry in Admin → Integrations; EN/UR translations; ADR update.

**Still gaps (tracked above, not started):** credential custody/authorization model for P1/P2 adapters; seeded statutory
compliance calendar; client-type-aware return schedules (AOP/company); client-portal filing-status view;
ATL/filer-status auto-refresh; expanded document taxonomy for AOP/company documents.

---

## 13. Next integration steps for real IRIS credentials/API

1. **Legal/compliance review** of what IRIS's terms of service and FBR regulations actually permit for third-party
   automation before building any RPA adapter (P1). This is a prerequisite, not an engineering task.
2. **Authorization model**: design and build a `ClientAuthorization` record (scope, expiry, revocation, audit) before
   any adapter is allowed to hold or use client IRIS credentials.
3. **Credential storage**: extend `modules/kms` usage to a new `IrisCredential` model (firm+client scoped, encrypted),
   following the same pattern as `Client.cnicEncrypted`/`ntnEncrypted`.
4. **Pilot RPA adapter** behind a firm-level feature flag, starting with `fetchStatus`/`syncCredentials` (lower risk,
   read-mostly) before enabling `submitReturn` (highest risk, write/irreversible).
5. **Monitor FBR/PRAL developer channels** for any official API announcement; if one appears, implement `ApiIrisAdapter`
   against it directly and retire the RPA path for firms that opt in.
6. Until 1–5 land, **the manual-recording path shipped in this task is the production path** — invest in making that
   workflow fast (bulk reference-number entry, deadline reminders, export quality) rather than over-building for an API
   that may not exist yet.
