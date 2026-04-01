# Deployment Guide

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed and authenticated (see below)
- A Cloudflare account with Workers, D1, and R2 enabled
- A [Resend](https://resend.com) account with an API key

### Authenticating with Cloudflare

**Option A — Browser OAuth (interactive):**
```bash
npx wrangler login
```
A browser tab opens; approve access on the Cloudflare dashboard.

**Option B — API Token (non-interactive / CI-friendly):**
1. Go to **Cloudflare Dashboard → My Profile → API Tokens → Create Token**
2. Use the **"Edit Cloudflare Workers"** template (adds D1 + R2 + Workers permissions)
3. Set the token in your shell before running any `wrangler` or `npm run db:migrate` commands:
   ```powershell
   $env:CLOUDFLARE_API_TOKEN = "your-token-here"
   ```
   Or add it to `.env` / your CI secrets — wrangler picks it up automatically.

---

## First-time setup

### 1. Create D1 database

```bash
npx wrangler d1 create imago-db
```

Copy the `database_id` from the output and verify it matches `wrangler.jsonc`.

### 2. Create R2 bucket

```bash
npx wrangler r2 bucket create imago-images
```

### 3. Apply database migrations

```bash
npx wrangler d1 migrations apply imago-db --remote
```

---

## Secrets

Fill in your real values in `.prod.vars` (already gitignored), then push them all at once:

```bash
npm run secrets:push
```

`scripts/push-prod-secrets.js` reads `.prod.vars` and calls `wrangler secret put` for each key automatically. Any key whose value is still a placeholder is skipped with a warning so you can fill it in and re-run. Re-running is safe — it just overwrites existing secrets.

---

## Deploy

> **Note:** In normal development flow, deploys are triggered automatically by GitHub. Pushing to the main branch runs the CI workflow which builds and deploys to Cloudflare Workers. Manual deployment below is only needed for hotfixes or when CI is unavailable.

```bash
npm run deploy
```

`npm run deploy` runs `vite build` then `wrangler deploy --minify`. Vite produces `dist/client/` which wrangler serves as static assets.

---

## First login

After deploying, visit `https://imago.workers.dev/admin/setup` once to create your admin account. The route is disabled once a user exists.

---

## Recover admin access

If you forget the admin password, use the recovery script. It wipes the admin account and lets you create a new one.

Locally:
```bash
npm run reset:admin
```

Against a deployed instance (you'll need `ADMIN_RESET_SECRET` from your Cloudflare Worker secrets dashboard):
```bash
npm run reset:admin -- --url https://your-deployed-worker.dev --secret <ADMIN_RESET_SECRET>
```

---

## Local development

### First-time local setup

```bash
# 1. Generate local secrets
npm run setup:dev

# 2. Apply migrations to local DB
npm run db:migrate:local

# 3. Start the worker and frontend
npx wrangler dev --port 8787   # Terminal 1
npm run dev                     # Terminal 2
```

### Ongoing local development

```bash
# After changing schema.ts, generate a new migration then apply it:
npm run db:generate
npm run db:migrate:local
```

Secrets for local dev are read from `.dev.vars`.

---

## Re-deploying

```bash
npm run build
npx wrangler deploy
```

If you changed the database schema, run migrations first:

```bash
npm run db:generate
npm run db:migrate:remote
```
