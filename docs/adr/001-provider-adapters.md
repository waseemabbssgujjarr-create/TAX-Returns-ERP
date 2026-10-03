# ADR 001 — Provider adapter interfaces

TaxDesk PK integrates external systems through small, swappable adapter interfaces bound in NestJS DI. Application code
depends on the interface token, not a vendor SDK.

## Adapters

| Interface               | Token / location                                                                | Default binding                                     |
| ----------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| `NotificationProvider`  | `NOTIFICATION_PROVIDER` — `modules/notifications/notification.provider.ts`      | SMTP / console adapter                              |
| `ObjectStorageProvider` | `OBJECT_STORAGE_PROVIDER` — `modules/storage/object-storage.interface.ts`       | MinIO (S3-compatible)                               |
| `AiExtractionProvider`  | OpenAI adapter — `modules/ai-extraction/ai-extraction.provider.ts`              | OpenAI extraction                                   |
| `KeyManagementService`  | `KMS_TOKEN` — `modules/kms/kms.interface.ts`                                    | Local KMS (dev)                                     |
| `PaymentProvider`       | `PAYMENT_PROVIDER` — `modules/billing/payment.provider.ts`                      | Stub (throws until configured)                      |
| `FilingExportProvider`  | `FILING_EXPORT_PROVIDER` — `modules/export-generator/filing-export.provider.ts` | Stub (throws until configured)                      |
| `IrisSubmissionPort`    | `IRIS_SUBMISSION_PORT` — `integrations/iris/iris-submission.port.ts`            | `StubIrisAdapter` (always reports `not_configured`) |

## Rules

1. **Firm scope** — adapters receive `firmId` where tenancy matters; they must not aggregate across firms.
2. **Secrets** — API keys and KMS material live in environment / KMS, never in the database.
3. **Stubs** — payment and filing export stubs fail fast so misconfiguration is obvious in non-production.
4. **Tests** — unit tests mock interfaces; integration tests use local adapters (MinIO, Local KMS).

## Adding a new adapter

1. Define the interface and DI token next to the feature module.
2. Implement one production adapter and register it in the module `providers`.
3. Document the binding in this file.

## IrisSubmissionPort — why there is no "real" adapter yet

FBR does not currently publish a stable, generally-available public API for individual/AOP/company return submission on
IRIS. `StubIrisAdapter` resolves every call to `outcome: 'not_configured'` rather than throwing, so `IrisFilingService`
can surface an honest `PENDING_INTEGRATION` state instead of a fabricated success. Three real adapters are anticipated —
see `apps/worker/src/integrations/iris/iris-submission.port.ts` and `docs/pakistan-tax-automation-roadmap.md` §IRIS
integration strategy:

1. `ApiIrisAdapter` — once/if FBR or PRAL publish an official API.
2. `RpaIrisAdapter` — browser-automation/middleware bridge against the IRIS portal, used under an explicit client
   authorization and audited.
3. `ManualIrisAdapter` — not really an "adapter" at all: staff file by hand on IRIS using the exported return worksheet,
   then record the FBR acknowledgment number via `POST /tax-years/:id/filing/record-manual-reference`. This path is
   already implemented today and does not depend on (1) or (2).
