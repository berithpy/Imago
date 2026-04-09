# Imago — Copilot Instructions

Imago is a self-hosted photography gallery app: a Vite React SPA served as static assets and a Hono API worker, deployed together as a single Cloudflare Worker.

## Architecture

| Layer         | Location               | Notes                                                                                                                                    |
| ------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| React SPA     | `src/client/`          | React Router v7, served via Cloudflare Assets binding                                                                                    |
| Hono worker   | `src/worker/`          | Single Worker handles `/api/*`; assets fallback handled by Cloudflare                                                                    |
| Database      | D1 (SQLite)            | Schema defined in `src/worker/lib/schema.ts` via Drizzle ORM                                                                             |
| Storage       | R2 + Cloudflare Images | R2 key = `{galleryId}/{photoId}`, Images binding for transforms                                                                          |
| Auth (admin)  | better-auth            | Owns `/api/auth/*`; do not add Hono routes under that prefix                                                                             |
| Auth (viewer) | JWT cookie             | Issued by `/api/viewer/gallery/:slug/login` (password) or `/api/viewer/gallery/:slug/magic-link` (email whitelist); verified per-request |

## Key Commands

```bash
npm test                        # run all vitest tests
npm run test:routes             # worker route tests only
npm run dev                     # Vite dev server (client only)
npm run worker:dev              # wrangler dev (worker only)
npm run db:migrate:local        # apply D1 migrations locally
npm run db:migrate:remote       # apply D1 migrations to production
npm run db:generate             # generate new Drizzle migration after schema changes
```

> **Deployment** is handled exclusively by the existing CI/CD pipeline. Never run `npm run deploy` manually.

## Schema Changes

When modifying `src/worker/lib/schema.ts`, always run `npm run db:generate` to create a new migration file. Never hand-edit migration files that already exist. Apply locally with `npm run db:migrate:local` before testing.

## Testing Conventions

Worker route tests live in `src/worker/routes/__tests__/`. See `testHarness.ts` in that folder for the shared harness.

- Tests use a real D1 database via `wrangler getPlatformProxy({ persist: false })` — no in-memory mocks for DB or auth logic
- R2 and Cloudflare Images bindings are stubbed at the binding level
- Email (Resend) is mocked — tests assert the call was made, not delivery
- Each test file uses `beforeAll` / `afterAll` with the harness; use `resetDb()` between test cases
- Do not add new mocking layers for business logic — test against real SQL

## Route Map

| Prefix             | File                   | Who can call                  |
| ------------------ | ---------------------- | ----------------------------- |
| `/api/auth/*`      | better-auth (internal) | better-auth only              |
| `/api/admin/*`     | `routes/admin.ts`      | Authenticated admin session   |
| `/api/viewer/*`    | `routes/auth.ts`       | Public (issues viewer tokens) |
| `/api/galleries/*` | `routes/galleries.ts`  | Public or viewer token        |
| `/api/images/*`    | `routes/images.ts`     | Public or viewer token        |
| `/api/subscribe/*` | `routes/subscribe.ts`  | Public                        |

## Conventions

- All IDs are `crypto.randomUUID()` strings, not integers
- Soft deletes use `deleted_at` timestamp; queries must filter `WHERE deleted_at IS NULL`
- `is_public` galleries skip password checks; private galleries require a valid viewer JWT or admin session
- Bindings and secrets are typed in `Bindings` (see `src/worker/index.ts`)
- See `PLAN.md` for the active roadmap and stage sequencing
