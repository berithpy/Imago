# Imago

A self-hosted photo gallery app built on Cloudflare Workers. Supports multiple password-protected galleries, admin image management, and email subscriber notifications.

## Stack

- **Runtime** - Cloudflare Workers
- **Backend** - [Hono](https://hono.dev)
- **Frontend** - React + Vite (served as static assets)
- **Auth** - [better-auth](https://better-auth.com) with Drizzle + D1
- **Database** - Cloudflare D1 (SQLite)
- **Storage** - Cloudflare R2 + Images
- **Email** - Resend

## Local development

```bash
npm install

# Terminal 1 - Worker (localhost:8787)
npx wrangler dev --port 8787

# Terminal 2 - Vite frontend (localhost:5173, proxies /api to :8787)
npm run dev
```

Secrets for local dev go in `.dev.vars`:

```
JWT_SECRET=...
BETTER_AUTH_SECRET=...
ADMIN_RESET_SECRET=...
RESEND_API_KEY=...
```

## Deployment

See [DEPLOY.md](./DEPLOY.md) for full instructions.

```bash
npm run build
npx wrangler deploy
```

## Admin

- Visit `/admin/setup` once after deploy to create the admin account
- Then log in at `/admin`
- From the dashboard: create galleries, upload photos, manage content

## Galleries

Each gallery has a unique slug and a viewer password. Share the URL `/g/:slug` with clients - they enter the password to view the photos.