---
inclusion: always
---

# TaxDesk PK — Feature Specs Index

Specs live in `.kiro/specs/<number>-<slug>/`. Each spec has a `requirements.md` (EARS format) and, once requirements are
approved, a `design.md` and `tasks.md`.

**Rule:** Never start implementing a spec until requirements are approved. Never start the next spec until the current
one passes its Definition of Done.

## Spec Build Order (Phase 1 MVP)

| #   | Slug                    | Status                                                                    | Depends on              |
| --- | ----------------------- | ------------------------------------------------------------------------- | ----------------------- |
| 01  | `auth-tenancy`          | **Foundation complete** (auth/RLS/KMS/UI; E2E session needs seeded users) | —                       |
| 02  | `client-crm`            | **Foundation complete**                                                   | 01                      |
| 03  | `document-hub`          | **Foundation complete**                                                   | 01, 02                  |
| 04  | `tax-year-workspace`    | **Foundation complete**                                                   | 01, 02                  |
| 05  | `computation-engine-ui` | **Foundation complete** (blocks DRAFT rules)                              | 04 + tax-engine package |
| 06  | `wealth-statement`      | **Foundation complete**                                                   | 04, 05                  |
| 07  | `calendar-reminders`    | **Foundation complete**                                                   | 01, 02                  |
| 08  | `reports-pdf`           | Not started (FilingExportProvider stub only)                              | 05, 06                  |
| 09  | `client-portal`         | **Foundation complete**                                                   | 01, 02, 03              |

## How to start a spec with Kiro

```
"Read .kiro/specs/01-auth-tenancy/requirements.md and the steering files.
Review the requirements, then produce a design.md covering: data model changes,
API endpoints, component tree, and state management. Wait for my approval before
producing tasks.md."
```

Once design is approved:

```
"The design for spec 01 is approved. Produce tasks.md as a concrete,
ordered task list. Each task must reference the acceptance criterion it satisfies.
Wait for my approval before beginning implementation."
```

## Prompt to continue from this point

> "Read `.kiro/steering/specs-index.md`. The next spec to start is **01-auth-tenancy**. Read its requirements.md and all
> steering files, then produce a `design.md` covering the data model (changes to prisma/schema.prisma), API surface
> (NestJS controllers/guards), session/cookie strategy, TOTP flow, RLS policies, and the login/2FA UI component tree.
> Follow all standards in ux-standards.md and security.md. Do not begin tasks or implementation until I approve the
> design."
