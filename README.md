# Imago

A self-hosted photo gallery app built on Cloudflare Workers. Supports multiple password-protected galleries, admin image management, and email subscriber notifications.

You can check some of my pictures at https://imago.berith.moe

# Some background  

I've been getting back into photography, mainly as a creative outlet, I started with analog and instant film, one thing led to another I ended up taking some photography courses and I just started booking sessions. All the picture solutions I found were either too basic and didn't allow to download full res pictures, or were just too expensive, more than 24$/month.

There's always google drive, dropbox, but I wanted a simple password protected client shared gallery.

You may need to set up a cloudflare account and even set your credit card, but this project will run in the free tier for up to 10gb of storage and 100k requests per day, which is more than enough for a small photography business.

## Stack

- **Runtime** - Cloudflare Workers
- **Backend** - [Hono](https://hono.dev)
- **Frontend** - React + Vite (served as static assets)
- **Auth** - [better-auth](https://better-auth.com) with Drizzle + D1
- **Database** - Cloudflare D1 (SQLite)
- **Storage** - Cloudflare R2 + Images
- **Email** - Resend (to be implemented)

## Local development

```bash
npm install

# Terminal 1 - Worker (localhost:8787)
npm run worker:dev

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

We also have cloudflare's ci/CD integration set up, so pushing to the `main` branch will trigger a deploy.

## Admin

- Visit `/admin/setup` once after deploy to create the admin account
- Then log in at `/admin`
- From the dashboard: create galleries, upload photos, manage content

## Galleries

Each gallery has a unique slug and a viewer password. Share the URL `/gallery/:slug` with clients - they enter the password to view the photos.

