# Deployment Guide

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed and logged in (`npx wrangler login`)
- A Cloudflare account with Workers, D1, and R2 enabled
- A [Resend](https://resend.com) account with an API key

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

Fill in your real values in `.prod.vars` (already gitignored), then push each secret:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_RESET_SECRET
npx wrangler secret put RESEND_API_KEY
```

Paste the value from `prod.vars` when prompted for each one.

---

## Deploy

```bash
npm run build
npx wrangler deploy
```

`npm run build` runs Vite to produce `dist/client/`, which wrangler serves as static assets.

---

## First login

After deploying, visit `https://imago.workers.dev/admin/setup` once to create your admin account. The route is disabled once a user exists.

---

## Local development

```bash
# Terminal 1 — Worker
npx wrangler dev --port 8787

# Terminal 2 — Vite frontend (proxies /api → :8787)
npm run dev
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
npx wrangler d1 migrations apply imago-db --remote
```
