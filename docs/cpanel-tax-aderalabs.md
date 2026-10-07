# Deploy TaxDesk PK on cPanel — `tax.aderalabs.tech`

Live deployment guide for **AdEra Labs FinTax / TaxDesk PK** on cPanel with external Upstash Redis, cPanel PostgreSQL, Google Drive document storage, and OpenAI document extraction.

## Production architecture

| Layer | URL / service | Role |
|-------|----------------|------|
| **Web** | https://tax.aderalabs.tech | Next.js 15 (Node 20, `apps/web/server.cjs`, host `PORT`) |
| **API + jobs** | https://api.tax.aderalabs.tech | NestJS worker (`apps/worker/dist/main.js`, `PORT` / `WORKER_PORT`, bind `0.0.0.0`) |
| **PostgreSQL** | cPanel Postgres | Runtime: `iqpigeon_taxdesk_app` via `DATABASE_URL` (RLS, no DDL). Migrations: `iqpigeon_taxdesk_migrations` via `DATABASE_MIGRATIONS_URL` **deploy only** |
| **Redis** | [Upstash](https://upstash.com) | `REDIS_URL=rediss://default:PASSWORD@HOST:6379` — BullMQ in worker (native Redis protocol, **not** Upstash REST) |
| **Documents** | Each staff member's **Google Drive** | `STORAGE_DRIVER=google-drive`, OAuth callback `https://api.tax.aderalabs.tech/integrations/google-drive/callback` |
| **AI** | OpenAI API | `OPENAI_API_KEY` required in production (worker-only; never `NEXT_PUBLIC_*`) |

Client document **binaries are not stored** on cPanel disk, MinIO, or S3 in production — only metadata in Postgres and files in the connected user's Drive.

Monorepo root on server: `repos/TAX-Returns-ERP` (adjust to your cPanel Git path).

## What you are deploying

TaxDesk PK is a **pnpm monorepo**, not a static site:

| Component | Path | Runtime |
|-----------|------|---------|
| Next.js web app | `apps/web` | Node 20, **`node apps/web/server.cjs`** (repo root), `PORT` from cPanel |
| NestJS API + BullMQ | `apps/worker` | Node 20, **`node apps/worker/dist/main.js`**, `PORT` then `WORKER_PORT` |
| Shared packages | `packages/*` | Built via `pnpm build` |
| Database schema | `prisma/` | `pnpm prisma:migrate` with migrations role only |

The browser loads the web app at `tax.aderalabs.tech`; authenticated API calls use `NEXT_PUBLIC_API_URL=https://api.tax.aderalabs.tech`.

**Production requirements:**

- `NODE_ENV=production`
- `STORAGE_DRIVER=google-drive` (local disk refused at startup)
- `REDIS_URL` (Upstash `rediss://…`)
- `OPENAI_API_KEY` + model env vars
- `GOOGLE_OAUTH_*` + `WORKER_PUBLIC_URL=https://api.tax.aderalabs.tech`
- Runtime worker env: **`DATABASE_URL` only** — do **not** require `DATABASE_MIGRATIONS_URL` on the running API process

---

## Honest limits of typical shared cPanel

Many shared cPanel plans **do not** provide:

- A managed PostgreSQL instance you can reach from Node
- Long-running **two** Node processes (web + worker) with Redis
- Enough RAM for `pnpm build` + Next.js production

If your host only offers **MySQL**, **one** small Node app, and no Redis, this stack will not run correctly without **external services**:

- **Database:** [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app), or a **VPS** with Postgres (same as `docker-compose.yml` locally)
- **Redis:** Upstash, Redis Cloud, or VPS Redis
- **App runtime:** VPS, Cloudways, Render, Fly.io, or cPanel on a **VPS** with Node Selector + enough resources

Use cPanel Git + Node only when your plan supports **Node.js 20+**, **SSH or Terminal**, and you can point env vars at **remote** Postgres/Redis/S3.

---

## DNS and SSL (subdomain)

1. In your DNS zone for `aderalabs.tech`, add:
   - **Type:** `A` (or `CNAME` if cPanel docs say so)
   - **Name:** `tax`
   - **Target:** your cPanel server IP or hostname
2. In cPanel → **Domains** → **Subdomains**, create `tax.aderalabs.tech` (document root is often `public_html/tax` or similar).
3. In cPanel → **SSL/TLS Status** (or **AutoSSL**), issue a certificate for `tax.aderalabs.tech`.
4. Set production URLs in env (never commit these in git):
   - `NEXT_PUBLIC_APP_URL=https://tax.aderalabs.tech`
   - `NEXT_PUBLIC_API_URL=https://api.tax.aderalabs.tech`
5. Create API subdomain `api.tax.aderalabs.tech` → second Node.js app (worker) or reverse proxy to worker port.

---

## One-time setup: Git on cPanel

Repository: **https://github.com/waseemabbssgujjarr-create/TAX-Returns-ERP.git**

### Option A — cPanel “Git Version Control” (recommended if available)

1. cPanel → **Git Version Control** → **Create**.
2. Clone URL: `https://github.com/waseemabbssgujjarr-create/TAX-Returns-ERP.git`
3. Repository path: e.g. `/home/USERNAME/repos/TAX-Returns-ERP` (not necessarily the web document root).
4. Branch: `main` (or whatever branch you push from development).
5. After clone, use **Manage** → **Pull or Deploy** for updates (see below).

### Option B — SSH terminal

```bash
cd ~
git clone https://github.com/waseemabbssgujjarr-create/TAX-Returns-ERP.git
cd TAX-Returns-ERP
git checkout main
```

---

## Environment variables (never commit `.env`)

1. Copy the template on the server:

   ```bash
   cp .env.example .env
   # Optional: app-specific files if your host sets them separately
   ```

2. Edit `.env` with production values. **Do not** commit `.env`, `.env.local`, or `.env.e2e.local` (they are gitignored).

3. Minimum production checklist (see `.env.example` for full list):

   - `NODE_ENV=production`
   - `DATABASE_URL` → `iqpigeon_taxdesk_app` (runtime; RLS; no BYPASSRLS; no DDL)
   - `DATABASE_MIGRATIONS_URL` → `iqpigeon_taxdesk_migrations` — **deploy/migrate step only**
   - `REDIS_URL=rediss://default:PASSWORD@HOST:6379` (Upstash)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=7d`
   - `OPENAI_API_KEY`, `OPENAI_EXTRACTION_MODEL`, `OPENAI_CLASSIFICATION_MODEL`
   - `ENCRYPTION_MASTER_KEY`, `OTP_CONTACT_SECRET`
   - `STORAGE_DRIVER=google-drive`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI=https://api.tax.aderalabs.tech/integrations/google-drive/callback`
   - `WORKER_PUBLIC_URL=https://api.tax.aderalabs.tech`
   - `SMTP_*`, `EMAIL_FROM`
   - `NEXT_PUBLIC_APP_NAME=TaxDesk PK`, `NEXT_PUBLIC_APP_URL=https://tax.aderalabs.tech`, `NEXT_PUBLIC_API_URL=https://api.tax.aderalabs.tech`

4. In cPanel **Setup Node.js App**, add the same variables in the UI if the panel does not read `.env` automatically.

---

## Recommended: pre-built bundles (4 GB / low memory)

Building the full monorepo **on cPanel often OOMs**. Prefer building on your PC or CI, then uploading **production-only** folders (no `pnpm install` on the server):

```bash
# On a build machine (not cPanel) — from repo root:
pnpm install
pnpm cpanel:bundle
pnpm cpanel:bundle:verify
```

This writes:

| Bundle | Path | cPanel startup |
|--------|------|----------------|
| Web | `dist/cpanel/web` | `server.cjs` (Next.js **standalone**) |
| Worker | `dist/cpanel/worker` | `node dist/main.js` |

Upload each folder to the matching Node.js app root (zip/rsync/scp). Set env vars in cPanel as below. Run **`pnpm prisma:migrate`** once per release from SSH or your workstation with `DATABASE_MIGRATIONS_URL` (not on the running worker env).

The worker bundle includes **production `node_modules` only**, workspace packages, and **Prisma Linux query engines** (`debian-openssl-*`) generated at bundle time.

---

## Install, build, migrate on-server (fallback)

Run from the repo root (SSH or cPanel terminal). Requires **Node 20+** and **pnpm 9+** (`corepack enable` then `corepack prepare pnpm@9.12.0 --activate` if needed). May OOM on 4 GB accounts.

```bash
cd ~/repos/TAX-Returns-ERP   # adjust path
git pull origin main

pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:migrate          # uses DATABASE_MIGRATIONS_URL — run only on deploy, not in app runtime env for worker if you split env files
pnpm build
```

On cPanel you can use `npm run build` (runs `prebuild` pnpm workspace install + sequential build). Start the Next.js app with `node apps/web/server.cjs` (`PORT` from the environment; no hardcoded port).

If migrations must use a different env file, export `DATABASE_MIGRATIONS_URL` only for that command, then run the worker with runtime env that **excludes** migrations URL (see comments in `.env.example`).

Optional demo data (non-production only):

```bash
pnpm db:seed:demo
```

---

## Document storage: Google Drive per-user

TaxDesk PK stores client documents in **each staff member's own Google Drive**
account rather than a shared bucket. There is no central storage credential
to provision — only an OAuth client that lets staff connect their own Drive.

### 1. Create the Google OAuth client (one-time, per environment)

1. In [Google Cloud Console](https://console.cloud.google.com), create (or
   reuse) a project and enable the **Google Drive API**.
2. **APIs & Services → OAuth consent screen** — configure as **Internal**
   (Google Workspace) or **External** with the firm's staff emails added as
   test users while in testing mode.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   type **Web application**.
4. **Authorized JavaScript origins:** `https://tax.aderalabs.tech`
5. **Authorized redirect URI** (must match `GOOGLE_OAUTH_REDIRECT_URI` exactly):
   `https://api.tax.aderalabs.tech/integrations/google-drive/callback`
6. Enable **Google Drive API**; use scopes `drive.file` + user email only (configured in worker).
7. Copy **Client ID** and **Client secret**.

### 2. Set production env vars

```bash
STORAGE_DRIVER=google-drive
GOOGLE_OAUTH_CLIENT_ID="<client id>.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="<client secret>"
GOOGLE_OAUTH_REDIRECT_URI="https://api.tax.aderalabs.tech/integrations/google-drive/callback"
WORKER_PUBLIC_URL="https://api.tax.aderalabs.tech"
```

Worker startup **refuses** `STORAGE_DRIVER=local` whenever `NODE_ENV=production`
(local disk storage is dev/E2E-only — not durable, not shared across app
instances, and never acceptable for real client documents). S3/MinIO env vars
(`S3_*`) are **not required** when using `google-drive`.

### 3. Each staff member connects their own Drive

After deploying, every staff user who uploads/downloads documents visits
**Settings → Storage → Google Drive** (`/en/settings/storage`) in the web app and
clicks **Connect Google Drive**. This:

- Redirects to Google's consent screen (scope: `drive.file` — the app can
  only see files/folders it creates, never the user's whole Drive).
- On return, the worker encrypts the refresh token with the existing KMS
  envelope-encryption scheme (`ENCRYPTION_MASTER_KEY`) and stores it per user.
- Creates a `TaxDesk PK/Clients/<clientId>/<taxYear>` folder structure inside
  **that user's own Drive**.

The **first** staff member to connect becomes the firm's default owner for
client-portal uploads (clients don't have their own Drive connection).

Downloads are **never** served via a public/shareable Drive link — the worker
always proxies bytes through its own HMAC-signed `/storage/drive-object`
endpoint using the owning user's refreshed OAuth access token server-side.

---

## Running the apps on cPanel

Configure **two** Node.js 20.x applications (Production mode):

### Web (Next.js) — `tax.aderalabs.tech`

| Setting | Value |
|---------|--------|
| Application root | `repos/TAX-Returns-ERP` (monorepo root) |
| Startup file | `apps/web/server.cjs` |
| Node | 20.x, production |
| Port | Host-provided `PORT` (required; server exits if unset) |

Build before start: `pnpm cpanel:build` or full `pnpm build` from repo root.

### Worker (NestJS API + BullMQ) — `api.tax.aderalabs.tech`

| Setting | Value |
|---------|--------|
| Application root | `repos/TAX-Returns-ERP` |
| Startup file | `apps/worker/dist/main.js` |
| Node | 20.x, production |
| Listen | `process.env.PORT` → `WORKER_PORT` → `3001`, bind `0.0.0.0` |

Runtime env: `DATABASE_URL`, `REDIS_URL`, secrets, Google/OpenAI — **no** `DATABASE_MIGRATIONS_URL`.
Run migrations separately with migrations URL: `DATABASE_MIGRATIONS_URL=… pnpm prisma:migrate`.

Restart both apps after each deploy from cPanel Node UI or:

```bash
touch tmp/restart.txt   # only if your host documents Passenger restart this way
```

Document root for a **pure static** export is **not** supported for the full product (no SSR/API routes without Node).

---

## Updating production: pull on cPanel

### Using Git Version Control UI

1. cPanel → **Git Version Control** → select **TAX-Returns-ERP**.
2. Click **Pull or Deploy** (or **Update from Remote**).
3. Confirm branch `main`.
4. SSH (or **Terminal**) into the account and run the **Install, build, migrate** block above.
5. Restart Node.js applications for web and worker.

### Using SSH only

```bash
cd ~/repos/TAX-Returns-ERP
git fetch origin
git pull origin main
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:migrate
pnpm build
# restart Node apps
```

---

## PostgreSQL on cPanel (AdEra Labs)

- **Runtime:** `DATABASE_URL` → database/user `iqpigeon_taxdesk_app` — subject to **FORCE ROW LEVEL SECURITY**, not table owner, no `BYPASSRLS`, no DDL.
- **Migrations:** `DATABASE_MIGRATIONS_URL` → `iqpigeon_taxdesk_migrations` — owner role for `pnpm prisma:migrate` only.
- Preserve audit append-only rules, FirmDirectory protection, and Google Drive tenant tables from `prisma/migrations/` (including `20261005000000_google_drive_storage`).

Never run `prisma migrate deploy` with the runtime app role.

---

## Security reminders

- Never commit `.env`, credentials, TOTP secrets, or `.local-storage/`.
- Use HTTPS only in production (`NEXT_PUBLIC_APP_URL` with `https://`).
- Keep `DATABASE_MIGRATIONS_URL` off the running worker process if your deployment layout allows split env files.
- Rotate JWT and encryption secrets if they were ever exposed.

---

## Quick reference

| Step | Command / action |
|------|------------------|
| Clone | cPanel Git → `https://github.com/waseemabbssgujjarr-create/TAX-Returns-ERP.git` |
| Update | `git pull origin main` then install/build/migrate |
| Build | `pnpm build` from repo root |
| Migrations | `pnpm prisma:migrate` |
| Web | `pnpm --filter @taxdesk/web start` |
| Worker | `pnpm --filter @taxdesk/worker start` |
| Public URL | `https://tax.aderalabs.tech` |

For local development, use `pnpm dev:local` and `docker compose up -d` on your workstation—not on shared cPanel unless Docker is explicitly available.
