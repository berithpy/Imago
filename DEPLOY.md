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

### 4. Configure Resend email

1. Create a free account at [resend.com](https://resend.com)
2. **Verify a sending domain** — go to **Resend → Domains → Add Domain** and follow the DNS instructions. Alternatively you can use the Resend sandbox domain `onboarding@resend.dev` for testing (delivers only to the account owner's email).
3. **Create an API key** — go to **Resend → API Keys → Create API Key** (give it "Send" access only).
4. Set your secrets and vars:
   - Add `RESEND_API_KEY` to `.prod.vars` then run `npm run secrets:push` (the key is a secret, never put it in `wrangler.jsonc`).
   - Add `FROM_EMAIL=noreply@yourdomain.com` to `.prod.vars` with your verified sender address, then run `npm run secrets:push`.

> **Note:** If `RESEND_API_KEY` is missing or is the placeholder value, the worker will log a warning and silently skip all email sends — the app continues to function normally without email delivery.

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

> **Email in local dev:** `setup:dev` sets `RESEND_API_KEY` to a placeholder. Emails won't be sent — instead a warning is logged to the wrangler console. To test real email delivery locally, replace the `RESEND_API_KEY` and `FROM_EMAIL` values in `.dev.vars` with your actual key and a verified sender address.

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
