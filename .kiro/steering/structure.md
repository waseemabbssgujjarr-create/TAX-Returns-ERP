---
inclusion: always
---

# TaxDesk PK — Project Structure

## Monorepo Layout

```
/
├── apps/
│   ├── web/                  # Next.js staff app + client portal (route groups)
│   └── worker/               # NestJS background worker (OCR, reminders, exports)
├── packages/
│   ├── tax-engine/           # Pure TypeScript, no I/O, 100% unit-tested
│   ├── rules/                # Versioned tax rule data (JSON) per tax year
│   ├── ui/                   # Design system components + tokens
│   ├── schemas/              # Zod schemas shared by client and server
│   └── i18n/                 # en.json, ur.json translation files
├── docs/                     # Product brief, ADRs, specs reference
├── .kiro/
│   ├── steering/             # Always-on Kiro context files
│   ├── hooks/                # Agent hooks (lint, tests, i18n checks)
│   └── specs/                # Feature specs (requirements, design, tasks)
├── docker-compose.yml        # Local dev: Postgres, Redis, MinIO
├── package.json              # pnpm workspace root
└── pnpm-workspace.yaml
```

## Package Responsibilities

### `apps/web`

- Route groups: `(staff)` for the consultant app, `(portal)` for the client-facing PWA.
- Consumes `@taxdesk/ui`, `@taxdesk/schemas`, `@taxdesk/tax-engine`, `@taxdesk/i18n`.
- All pages SSR or ISR; client components only where interactivity requires it.
- PWA: service worker, offline drafts, sync queue.

### `apps/worker`

- NestJS modules: `DocumentProcessor`, `ReminderScheduler`, `ExportGenerator`, `AiExtraction`.
- Consumes BullMQ queues; idempotent job handlers with retries and DLQ.
- The only place that calls external AI/OCR APIs.
- Connects to shared Postgres and Redis.

### `packages/tax-engine`

- **Pure function:** `compute(inputs: TaxInputs, rules: RulesBundle): ComputationResult`.
- No database calls, no HTTP, no side effects.
- Exports `explanationTree` alongside each result so the UI can render "why this number".
- Runs identically in the browser (live preview) and on the server (authoritative result).
- 100% unit test coverage target; golden test cases per tax year in `packages/rules`.

### `packages/rules`

- Directory structure: `rules/<taxYear>/index.json` + per-section JSON files.
- Each rule file includes: `effectiveFrom`, `effectiveTo`, `sourceReference`, `reviewedBy`, `reviewedOn`, `version`.
- Schema validated with Zod at load time.
- Breaking changes require a version bump and a new directory, never in-place mutation.

### `packages/ui`

- Design tokens as CSS custom properties (in `tokens.css`) and a Tailwind preset (`tailwind.preset.ts`).
- Radix-based component wrappers with enforced accessibility props.
- Storybook stories for every component in LTR, RTL, light, dark, 320px, 768px, 1440px.
- No business logic; no API calls.

### `packages/schemas`

- Zod schemas for: core DB entities, API request/response bodies, AI extraction outputs.
- The source of truth for validation — shared by frontend forms, backend controllers, and worker jobs.
- Export inferred TypeScript types alongside every schema.

### `packages/i18n`

- `en.json` and `ur.json` as flat namespaced key trees.
- Keys must be identical in both files; the i18n hook CI check enforces this.
- Urdu values use proper Nastaliq script; right-to-left strings are not reversed — the `dir` attribute handles
  direction.

## Key Conventions

- **No cross-app imports.** `apps/web` and `apps/worker` must not import from each other.
- **No business logic in `apps/web`.** Tax computation and data transformation live in packages.
- **Shared Prisma schema** lives at the repo root in `/prisma/schema.prisma`; migrations are run by the worker on
  startup in production.
- **Environment-specific config** via `.env` files per app; validated with Zod at startup.
- **ADRs** (Architecture Decision Records) go in `/docs/adr/` — create one for any significant technology choice or
  structural change.
