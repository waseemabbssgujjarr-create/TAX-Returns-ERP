# Feature Spec Alignment — TaxDesk PK vs. `01-FEATURE-SPEC-CURSOR.md`

> Short, working plan. Source: external spec `01-FEATURE-SPEC-CURSOR.md` (F1–F12, P0–P12). Cross-checked against
> `docs/pakistan-tax-automation-roadmap.md` and the existing `IrisFiling` / `FilingSection` / stub-adapter foundation
> (not rebuilt — extended where the spec required more). Update this doc as work lands; keep it to one page.

## Spec's core claim (we already agree with it)

No public FBR API exists for income tax / wealth / sales-tax / WHT-statement filing — only Digital Invoicing (F9)
is official. Everything else is manual IRIS web-form entry or FBR's offline Excel templates. **Consequence:** this
product is a preparation/validation workbench, never an auto-filer. Never: unattended filing, CAPTCHA-solving, or a
default credential vault. Our roadmap's `ManualIrisAdapter → RpaIrisAdapter → ApiIrisAdapter` phasing and honest
`IrisFilingStatus` already match this — no change needed there.

## Already exists (verified, not rebuilt)

- Client CRM, document hub + AI extraction, tax-year workspace, deterministic tax engine + versioned rules
  (fail-closed on DRAFT data), wealth reconciliation, return preparation (draft→review→approve), PDF export.
- **IRIS tracking foundation**: `IrisFiling` model, `IrisFilingService`, `FilingSection` UI, stub `IrisSubmissionPort`,
  manual-reference recording, readiness checklist (`filing-readiness.util.ts`), audit trail. This is F2/F5's
  submission backbone — extended this pass, not replaced.
- Document categories already cover WHT/CPR/wealth-statement evidence (`CPR_PAYMENT_RECEIPT`, `WEALTH_STATEMENT`,
  `NTN_CERTIFICATE`, `CNIC_COPY`, `AOP_PARTNERSHIP_DEED`, `COMPANY_INCORPORATION_DOCUMENT`) and the upload UI is
  schema-driven (new categories need zero UI code).
- Row-level WHT validator (Valid/Invalid Registration No./Code/Name/Transaction Date) and a standalone WHT
  readiness checklist (`withholding.service.ts: checklist()`) — shipped previously.
- Firm-wide Returns list/nav (F4 partial) — shipped previously.
- s.182 / s.182A penalty calculator, fully versioned DRAFT rules data — shipped previously.

## Shipped this pass

1. **CPR-before-submit gate now actually blocks IRIS submission** (not just advisory). `IrisFilingService`'s
   readiness check previously only looked at withholding *reconciliation* (matched/unmatched); it ignored the WHT
   row-validation status and CPR presence entirely, so a return with unresolved "Invalid Code" rows or missing CPRs
   could still be marked `READY` and submitted. Added two error-severity checklist items
   (`WITHHOLDING_ROWS_VALID`, `WITHHOLDING_CPR_RECORDED`) wired into `computeFilingReadiness`, mirroring the exact
   gate the spec's F2 describes ("IRIS blocks submission until the withheld tax is actually paid, CPR in hand").
   This is the single highest-value gap: the checklist existed in the UI but didn't gate the real action.
2. **Returns list now shows IRIS filing status per tax year** (`filingStatus` column, joined from `IrisFiling`).
   Closes part of F4 — staff can see "which returns are filed vs. still drafting" from one firm-wide screen instead
   of opening each client.
3. i18n EN+UR for the new column; `apps/worker` and `apps/web` typecheck clean; targeted test suites (14 tests incl.
   2 new) pass; no schema/migration changes required this pass (pure logic + i18n).

## Deliberately not done this pass (next, in order)

1. **F1 — Sales-tax annexure generator (A/B/C/J)**. Biggest remaining gap vs. spec's Phase 1 priorities. Needs a
   byte-faithful FBR Excel template service first (shared with F2's export step) — real effort, not a quick add.
2. **F2 export** — WHT entries validate and gate correctly now, but there's still no "export to FBR's official WHT
   Excel template" button. Needs the same template service as F1.
3. **F3 calendar seeding** — penalty math exists; the actual PK statutory deadline calendar (ST monthly, WHT Rule
   44/s.149, annual return + extensions) isn't seeded from real sourced data yet.
4. Phase 2 (F6 bank ingestion, F7 full computation-review engine, F8 WhatsApp intake) and Phase 3 (F9 e-invoicing,
   F10 e-scrutiny specifics, F11 opt-in downloader, F12 billing) — correctly gated behind pilot traction per the
   spec's own build-order rule. Not started, not recommended yet.

## Deployment checklist (handed off next)

- No new Prisma migration from this pass (schema unchanged). Run `pnpm prisma migrate deploy` only if deploying
  from a commit that includes the *previous* pass's migration (`20261003130000_wht_iris_gates_and_doc_categories`).
- Env vars: none added this pass.
- `docker compose up` (postgres + redis) as already configured; no new services introduced.
- No git commit made — repo has no `.git` initialized in this workspace.
