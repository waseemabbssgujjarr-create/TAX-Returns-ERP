# Deploy TaxDesk PK on cPanel — `tax.aderalabs.tech`

This guide explains how to **clone or pull** this monorepo on cPanel and run updates for the subdomain **https://tax.aderalabs.tech**. It aligns with `.env.example` and root `package.json` scripts; it does **not** replace Docker-based local dev (`docker-compose.yml`).

## What you are deploying

TaxDesk PK is a **pnpm monorepo**, not a static site:

| Component | Path | Runtime |
|-----------|------|---------|
| Next.js web app | `apps/web` | Node.js 20+, `next start` (port e.g. 3000) |
| NestJS API + jobs | `apps/worker` | Node.js 20+, `node dist/main` (port e.g. 3001) |
| Shared packages | `packages/*` | Built as part of `pnpm build` |
| Database schema | `prisma/` | PostgreSQL via `pnpm prisma:migrate` |

The browser talks to Next.js; API/auth can use Next rewrites or `NEXT_PUBLIC_API_URL` pointing at the worker (see `.env.example`).

**Dependencies the app expects in production:**

- **PostgreSQL 16** (two DB roles: `DATABASE_URL` for app, `DATABASE_MIGRATIONS_URL` for migrations only)
- **Redis** (BullMQ queues in the worker)
- **S3-compatible storage** (or `STORAGE_DRIVER=local` only if you accept filesystem storage on the server)

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
   - `NEXT_PUBLIC_API_URL` — either `https://api.tax.aderalabs.tech` (separate worker vhost) or leave empty if Next.js proxies `/auth` to the worker internally on localhost.

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

   - `DATABASE_URL` — app role, no DDL
   - `DATABASE_MIGRATIONS_URL` / `DATABASE_DIRECT_URL` — migrations role only for deploy step
   - `REDIS_URL`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (unique, strong)
   - `ENCRYPTION_MASTER_KEY`, `OTP_CONTACT_SECRET`
   - `STORAGE_DRIVER=s3` + S3 vars (recommended on cPanel) or secured local path
   - `NEXT_PUBLIC_APP_URL=https://tax.aderalabs.tech`
   - `WORKER_PORT=3001`, `NODE_ENV=production`

4. In cPanel **Setup Node.js App**, add the same variables in the UI if the panel does not read `.env` automatically.

---

## Install, build, migrate (each deploy)

Run from the repo root (SSH or cPanel terminal). Requires **Node 20+** and **pnpm 9+** (`corepack enable` then `corepack prepare pnpm@9.12.0 --activate` if needed).

```bash
cd ~/repos/TAX-Returns-ERP   # adjust path
git pull origin main

pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:migrate          # uses DATABASE_MIGRATIONS_URL — run only on deploy, not in app runtime env for worker if you split env files
pnpm build
```

On cPanel you can use `pnpm cpanel:install` then `pnpm cpanel:build` (generate + migrate + `@taxdesk/web` build). Start the Next.js app with `node apps/web/server.cjs` (`PORT` from the environment; no hardcoded port).

If migrations must use a different env file, export `DATABASE_MIGRATIONS_URL` only for that command, then run the worker with runtime env that **excludes** migrations URL (see comments in `.env.example`).

Optional demo data (non-production only):

```bash
pnpm db:seed:demo
```

---

## Running the apps on cPanel

You usually need **two** Node applications (or one Node app + worker via systemd on a VPS):

### Web (Next.js)

- **Application root:** `apps/web` **or** repo root with start command `pnpm --filter @taxdesk/web start`
- **Application mode:** Production
- **Node version:** 20.x
- **Startup file / script:** `node apps/web/server.cjs` from the repo root (or `node server.cjs` if the application root is `apps/web`). Alternatives: `node_modules/next/dist/bin/next` with args `start -p $PORT`, or `pnpm --filter @taxdesk/web start`
- Map the subdomain `tax.aderalabs.tech` to this app in **Setup Node.js App** (Passenger or proxy to the Node port).

### Worker (NestJS)

- **Application root:** `apps/worker`
- **Start:** `node dist/main` after build (or `pnpm --filter @taxdesk/worker start`)
- Expose via internal `127.0.0.1:3001` or a separate subdomain `api.tax.aderalabs.tech` with its own Node app / reverse proxy.

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

## PostgreSQL on cPanel

- **Shared hosting:** often **MySQL only** — use a **remote PostgreSQL** provider and put the connection string in `DATABASE_URL` / migration URLs on the server.
- **VPS cPanel:** you may install Postgres yourself or use a managed DB; run `infra/postgres/init.sql` logic via your DBA or follow `docker-compose.yml` + `infra/postgres/` for role separation.

Never run `prisma migrate` with the app user if your init scripts require the migrations owner role.

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
