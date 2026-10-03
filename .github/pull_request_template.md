# Pull Request Checklist — TaxDesk PK

## Architecture & Security (required for every PR)

- [ ] All tenant-scoped DB operations use `PrismaRlsClient.withRlsContext()`
- [ ] Multi-step atomic operations share one `withRlsContext()` call (IC-1)
- [ ] Nested `withRlsContext()` reuses the active transaction (never opens a silent second txn)
- [ ] No plaintext TOTP secret stored, returned, or logged
- [ ] No access token written to `localStorage` or `sessionStorage`
- [ ] New audit log events added to the `AuditEntry` discriminated union
- [ ] `en.json` and `ur.json` parity maintained for any new i18n keys
- [ ] RLS integration tests updated for any new tenant-scoped tables
- [ ] `DATABASE_MIGRATIONS_URL` is never used by runtime application code
- [ ] No imports of `@taxdesk/tax-engine` or `@taxdesk/rules` in auth modules

## Testing

- [ ] Unit tests added/updated
- [ ] Integration / RLS tests updated where applicable
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Format check passes

## Summary

<!-- What changed and why -->
