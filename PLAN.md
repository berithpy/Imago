# Imago  Project Plan

## Stage 10  Backend Testing

### Goal
A local test suite that exercises the Hono API routes against a real (in-memory) D1-compatible SQLite database — no deployment, no mocking of business logic. Tests should be runnable with `npm test` and fast enough to run in CI on every push before deploy.

---

### Approach

**Tooling already in place:** `vitest` is installed, `src/worker/routes/__tests__/` directory exists.

**Runtime strategy:** Use Wrangler's `getPlatformProxy()` (or `@cloudflare/vitest-pool-workers`) to get a real local D1 binding backed by in-memory SQLite. This means tests run real SQL — no mocking the database. R2 and IMAGES bindings are mocked with simple in-memory stubs.

For each test file:
1. `beforeAll` — get platform proxy, apply the Drizzle migration (`0000_complete_microbe.sql`) to a fresh DB, seed minimal data (admin user, a test gallery).
2. Call routes via `app.request(new Request(...), env)` — Hono's built-in test helper, no HTTP server needed.
3. `afterAll` — dispose proxy.

---

### Test files to create

**`__tests__/admin.test.ts`**
- `POST /api/admin/setup` — creates first user, returns 403 if called again
- `POST /api/admin/galleries` — creates gallery, rejects missing fields
- `GET /api/admin/galleries` — returns empty list, then one after creation
- `DELETE /api/admin/galleries/:id` — soft-deletes, then permanent delete
- `POST /api/admin/galleries/:id/photos` — upload stub (mock R2 put), inserts DB row
- `DELETE /api/admin/galleries/:id/photos/:photoId` — removes from DB (mock R2 delete)
- `GET /api/admin/galleries/:id/allowed-emails` — empty, then one after add (Stage 9)

**`__tests__/auth.test.ts`**
- `POST /api/viewer/gallery/:slug/login` — correct password issues JWT cookie, wrong password 401
- `POST /api/viewer/gallery/:slug/login` — public gallery accepts with no password
- `POST /api/viewer/gallery/:slug/magic-link` — 403 for non-whitelisted email, 200 for whitelisted email (mock better-auth send)
- `GET /api/galleries/:slug/photos` — private gallery: 401 without viewer/admin auth, 200 with valid `viewer_token`
- `GET /api/galleries/:slug/photos` — public gallery: 200 without auth
- `POST /api/viewer/admin/magic-link` — validates email format, always returns ok for non-leakage, triggers send only for registered admin
- `POST /api/viewer/admin/recover-by-email` — always returns ok, triggers send only when `recovery_email` exists

**`__tests__/subscribe.test.ts`**
- `POST /api/subscribe/galleries/:slug` — inserts unverified row, sends email (mock Resend)
- `GET /api/subscribe/confirm?token=` — verifies row, 400 on already-confirmed
- `GET /api/subscribe/unsubscribe?token=` — deletes row

**`__tests__/galleries.test.ts`**
- `GET /api/galleries/:slug/photos` — pagination, cursor, total count
- `GET /api/galleries/:slug` — returns metadata, 410 on expired gallery

---

### What is NOT tested here
- R2 / Cloudflare Images actual transforms (mocked at the binding level)
- Email delivery (Resend is mocked — tests verify the call was made with the right recipient/subject)
- The React frontend (separate concern; a future E2E stage could use Playwright)

---

### CI integration

Add a GitHub Actions step before the deploy step:
```yaml
- name: Run backend tests
  run: npm test
```

Tests must pass before `npm run deploy` is triggered. This gives confidence that schema migrations + route logic are consistent after every change.

### Husky integration (local test gate)

Add Husky so tests run automatically during local git workflows:

1. Install and initialize Husky.
2. Add a pre-push hook to run `npm test`.
3. Optionally add a fast pre-commit hook (lint/typecheck only) and keep full tests in pre-push for speed.

Suggested commands:

```bash
npm install -D husky
npx husky init
npx husky add .husky/pre-push "npm test"
```

Policy:
- If tests fail locally, push is blocked.
- CI still runs `npm test` as the final protection before deploy.

---

## Stage 11  Multitenancy

### Feasibility Assessment

The current app is single-tenant by design: one admin user, galleries with no owner FK, R2 keys with no tenant prefix. Turning it multi-tenant is well-defined work but non-trivial. Here is an honest assessment of each layer:

| Layer | Effort | Notes |
|---|---|---|
| Schema | Medium | Add `tenants` table, `tenant_id` FK on `galleries`, `photos`, `gallery_subscribers`. Migration is mechanical but existing rows need a default tenant. |
| API route scoping | Medium | Every query gains a `AND tenant_id = ?` clause. The `requireAdmin` middleware needs to resolve tenant from the request. |
| Auth | Medium-Hard | better-auth's `organization` plugin handles multi-tenant users with roles. Adds `organization`, `member`, `invitation` tables. Alternatively, a custom `tenant_id` column on `user`. The plugin is the cleaner path. |
| R2 key prefixing | Low | New uploads get `{tenantId}/{galleryId}/{filename}`. Existing objects need a one-time copy/rename script — straightforward but risky if run wrong. |
| Tenant routing strategy | Low–Hard | **Path prefix** (`/t/slug/...`) — easiest, no infra changes. **Subdomain** (`slug.imago.app`) — needs Cloudflare wildcard DNS + per-tenant custom hostnames via the Cloudflare API; significant infra complexity. **Custom domain per tenant** — the hardest; requires programmatic DNS and SSL. **Recommendation: start with path prefix.** |
| Frontend routing | Medium | All React routes gain a tenant prefix. All API calls carry tenant context. |
| Admin onboarding | Low | Extend `/admin/setup` or add a self-serve sign-up. Per-tenant admin is just the first `organization` member. |

**Verdict:** Feasible in 3–4 focused sprints after Stage 10. The path-prefix routing approach and better-auth `organization` plugin keep complexity manageable. Subdomain routing should be deferred to after the multi-tenant core is working.

---

### Recommended Implementation Order (Stage 11)

1. **11a — Schema + migration** — `tenants` table, `tenant_id` FK columns, data migration to assign all existing data to a default "owner" tenant.
2. **11b — Auth: better-auth organization plugin** — enables per-tenant user roles (owner, member). Replaces the single-user model.
3. **11c — API scoping middleware** — `requireTenant` middleware resolves tenant from path prefix, injects into Hono context. All routes updated to scope queries.
4. **11d — R2 prefix migration** — script to copy existing R2 objects to `{tenantId}/...` keys, update DB rows, verify.
5. **11e — Frontend routing** — React Router paths updated to include tenant slug. Tenant context provider.
6. **11f — Tenant onboarding UI** — sign-up page, tenant creation, invite first admin user (reuses Stage 9 invitation flow).

---

## MVP Roadmap

Recommended order to reach a shippable, production-quality v1:

| Priority | Stage | Why first |
|---|---|---|
| 1 | **Stage 10** — Backend testing | Establishes a quality gate for route logic, schema changes, and deploy safety. |
| 2 | **Stage 11** — Multitenancy | Major architectural change. Much safer with a test suite in place. Path-prefix approach first; subdomain as a follow-up. |

