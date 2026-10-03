---
inclusion: always
---

# TaxDesk PK — Technology Stack & Conventions

## Stack Decisions

| Layer                 | Choice                                                                 | Notes                                         |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| Frontend              | Next.js (App Router) + TypeScript                                      | SSR, routing, PWA support                     |
| UI primitives         | Tailwind CSS + shadcn/ui (Radix)                                       | Accessible, fast theming                      |
| Animation             | Framer Motion + CSS transitions                                        | Declarative; respect `prefers-reduced-motion` |
| Forms                 | React Hook Form + Zod                                                  | Validation shared client/server               |
| Data tables           | TanStack Table + virtualization                                        | Large client lists                            |
| Charts                | Recharts                                                               | Dashboards                                    |
| State / data fetching | TanStack Query; Zustand for local UI state                             | Caching, optimistic updates                   |
| Backend               | NestJS (TypeScript)                                                    | Modular, typed, separate worker process       |
| Database              | PostgreSQL + Prisma; row-level security                                | Relational integrity for financial data       |
| Cache / queue         | Redis + BullMQ                                                         | Reminders, OCR jobs, exports                  |
| File storage          | S3-compatible, encrypted, signed URLs                                  | Documents                                     |
| OCR / AI extraction   | OpenAI API (structured outputs) behind `AiExtractionProvider` adapter  | Swappable; server-side only                   |
| Auth                  | Email + password + TOTP 2FA; optional phone OTP; RBAC + per-client ACL |                                               |
| PDF generation        | Playwright (server-side HTML → PDF) with Urdu fonts                    | Reports                                       |
| i18n                  | next-intl; Noto Nastaliq Urdu / Inter                                  | RTL support                                   |
| Testing               | Vitest, Playwright, Storybook, axe-core                                | Unit, E2E, visual, a11y                       |
| Infra                 | Docker, GitHub Actions CI/CD, Terraform                                | Repeatable                                    |
| Observability         | OpenTelemetry, Sentry, structured logs                                 |                                               |

## Code Conventions

### TypeScript

- Strict mode always on (`"strict": true`).
- No `any` — use `unknown` with narrowing or proper types.
- Export types from index files; never import from deep paths across packages.
- Use `satisfies` and `as const` for rule/config objects.

### File Naming

- Components: `PascalCase.tsx`
- Utilities, hooks, helpers: `camelCase.ts`
- Route files: Next.js conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`)
- Test files: co-located `*.test.ts` / `*.spec.ts`

### Money

- All monetary values stored and computed as **integer paisa** (1 PKR = 100 paisa).
- Display only: convert to PKR with `formatPKR(paisa: bigint): string`.
- Never use `number` for money — use `bigint` or the `Decimal` library.
- Never use floating-point arithmetic on tax figures.

### Imports

- Use path aliases: `@taxdesk/ui`, `@taxdesk/schemas`, `@taxdesk/tax-engine`, `@taxdesk/rules`, `@taxdesk/i18n`.
- No circular dependencies between packages.

### Error Handling

- Use a typed `Result<T, E>` pattern (or `neverthrow`) for domain operations — no silent swallows.
- API errors return RFC 7807 Problem Details JSON.

### Environment Variables

- All secrets via environment variables; validated at startup with Zod.
- Never commit `.env` files. Provide `.env.example` with placeholder values only.
- OpenAI API key lives in a secrets manager; never in the browser bundle.

### Accessibility

- Every interactive element must be keyboard-operable.
- Use Radix primitives for complex widgets (dialogs, dropdowns, tabs).
- Run `axe-core` assertions in Storybook and Playwright tests.

### Adapters

Define and code against these interfaces, never directly against the implementation:

- `OcrProvider`
- `AiExtractionProvider`
- `NotificationProvider` (email / SMS / WhatsApp)
- `PaymentProvider`
- `FilingExportProvider`
