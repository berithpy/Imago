# Imago  Project Plan
## Stage 9  Login Page Audit & Polish

### Goal
All authentication flows are now functional, but the login pages were built incrementally and have not been reviewed as a cohesive set. This stage audits every login surface, maps all auth flows end-to-end, identifies UX/visual gaps, and produces consistent, polished pages across the app.

---

### 9a — Flow Inventory

Map every login surface in the app and document what triggers it, what it does, and where it lands afterward. No assumptions — walk each flow manually in the browser.

**Surfaces to document:**

| Page | File | Trigger | Auth mechanism | Success destination |
|---|---|---|---|---|
| Admin setup | `AdminSetup.tsx` | First visit, no admin exists | Email + password (register) | Admin dashboard |
| Admin login | `AdminLogin.tsx` | `/admin/login` | Email → OTP code (better-auth emailOTP) | Admin dashboard |
| Gallery login — email | `GalleryLogin.tsx` | Private gallery, no cookie | Email → magic link (better-auth magicLink) | Gallery view |
| Gallery login — password | `GalleryLogin.tsx` | "Use a password instead" toggle | Password → viewer JWT cookie | Gallery view |
| Magic link callback | handled by better-auth | Click link in email | Token exchange → session cookie | `/gallery/:slug` redirect |

For each flow, note:
- Which API endpoints are called and in what order
- What cookies/tokens are set and their lifetimes
- What happens on error (wrong password, expired link, email not on whitelist, etc.)
- Whether the redirect after auth lands in the right place

---

### 9b — Visual & UX Review

Walk every login page and evaluate against these criteria:

- **Consistency** — do they share the same layout container, font sizes, button styles, and spacing?
- **Branding** — does the app name/logo appear? Is the page identifiable as "Imago"?
- **State feedback** — loading states (spinner/disabled button while request in flight), error messages, success/confirmation states
- **Mobile** — does the form look reasonable on a narrow viewport?
- **Empty/edge states** — what does the page look like before the user has typed anything? After a failed attempt?

Document findings per page as a short checklist of what needs fixing.

---

### 9c — Rework Login Pages

Implement the fixes identified in 9b. Treat all three pages as a set so they feel like a cohesive product.

Likely improvements (to be confirmed after 9b):
- Shared card/container layout used consistently across all auth pages
- App name (or wordmark) at the top of every auth page
- Consistent button styles and spacing matching the rest of the app (`ui.ts` tokens)
- Proper error display component (not raw text, not an alert)
- Disabled + loading state on the submit button during in-flight requests
- Clear confirmation screen after magic link is sent (already added, verify it looks good)
- Password fallback clearly secondary (already a divider, verify styling)
- Reasonable mobile width

---

### 9d — End-to-End Flow Testing

Manually step through every flow in the browser (both local dev and production) and verify:

- [ ] Admin setup: register → lands on dashboard
- [ ] Admin login: email → receive OTP email → enter code → lands on dashboard
- [ ] Admin login: wrong OTP → error shown, can retry
- [ ] Gallery login (magic link): enter whitelisted email → receive email → click link → lands on gallery
- [ ] Gallery login (magic link): enter non-whitelisted email → clear error (403), no email sent
- [ ] Gallery login (magic link): click expired link → clear error, not a crash
- [ ] Gallery login (password): correct password → lands on gallery
- [ ] Gallery login (password): wrong password → error shown
- [ ] Public gallery: navigating directly lands on gallery without any login prompt
- [ ] Magic link URL contains `localhost` locally and `imago.berith.moe` in production

Document any failures as issues to fix before closing the stage.

---

### 9e — Document Auth Architecture

Write a short section in `DEPLOY.md` (or a new `AUTH.md`) describing:
- The two auth systems in use (better-auth session for admin + viewer, viewer JWT cookie for password login) and why
- How `requireViewer` middleware resolves access (public bypass → JWT cookie → better-auth session + whitelist check)
- Environment variables required for auth to work (`BETTER_AUTH_SECRET`, `JWT_SECRET`, `APP_URL`)
- How to test magic links locally (links go to `localhost:5173`, works via Vite proxy)

---

### Pending from earlier work

- [ ] `dedicated lightbox route` `/gallery/:slug/photo/:id` — deep-linkable URL that opens the lightbox directly; useful for sharing individual photos in notification emails
- [ ] Lightbox route should be shareable, that means when you click on a thumnail of a picture, the route should change so that you can copy the url and share it with someone, then when you try to load the picture, you see the login page, login through email and the linked picture should load

---

---

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
- `GET /api/galleries/:slug/photos` — 401 without cookie, 200 with valid cookie
- OTP viewer login flow (Stage 9) — request OTP, verify OTP, access gallery

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
| 1 | **Stage 9** — Resend + email auth | Core usability: viewers can't be whitelisted, subscribers get no emails. Blocks real-world use. |
| 2 | **Stage 10** — Backend testing | Quality gate before the big Stage 11 refactor. Catches regressions from Stage 9 changes too. |
| 3 | **Stage 11** — Multitenancy | Major architectural change. Much safer with a test suite in place. Path-prefix approach first; subdomain as a follow-up. |

