# Imago  Project Plan
## Stage 9  Resend + Email-based Auth

### Goal
Replace the password-only admin login with OTP-over-email, wire up Resend to actually deliver all the transactional emails the app already has stubs for, add a per-gallery email whitelist so private galleries can be shared with specific people without a shared password, and add an admin user invitation flow.

---

### Sub-task 9a — Resend helper + email templates

**File to create:** `src/worker/lib/email.ts`

A thin typed wrapper around the Resend REST API (`fetch`-based, works in CF Workers — no Node SDK needed). A single `sendEmail(apiKey, { to, subject, html })` function used by all callers.

HTML templates (inline in the same file or as small template functions) for each transactional email:
- **Subscription confirmation** — "Click to confirm your subscription to [gallery name]" with a `/api/subscribe/confirm?token=` link
- **Unsubscribe confirmation** — "You have been unsubscribed" (plain, no link needed)
- **Gallery expiry warning** — "This gallery will be removed on [date]. Download your photos before then." with a link to the gallery and a download-all button
- **New photos notification** — "[N] new photos were added to [gallery name]" with a thumbnail grid teaser (or just the gallery link)
- **Admin OTP code** — "Your sign-in code is [code]. It expires in 10 minutes."
- **Invited user onboarding** — "You've been invited to [app name]. Click to set up your account."

**Notes:**
- All templates use plain HTML strings (no JSX/React Email for now — avoids a build step in the worker).
- `RESEND_API_KEY` is already in `Bindings`. The helper should gracefully no-op (log a warning) if the key is a placeholder so local dev doesn't crash.

---

### Sub-task 9b — Wire up subscribe emails

**File:** `src/worker/routes/subscribe.ts`

Replace the existing `// TODO` stub with real `sendEmail` calls:
- `POST /api/subscribe/galleries/:slug` → send subscription confirmation email
- `GET /api/subscribe/confirm` → send "you're now subscribed" confirmation email after verifying
- `GET /api/subscribe/unsubscribe` → send unsubscribe confirmation email

---

### Sub-task 9c — better-auth OTP login

**Files:** `src/worker/lib/auth.ts`, `src/client/pages/AdminLogin.tsx`

Add better-auth's `emailOTP` plugin to replace (or augment) the `emailAndPassword` flow:
- Configure `emailOTP({ async sendVerificationOTP({ email, otp }) { ... } })` using the Resend helper
- The plugin handles: generate a 6-digit code, store it in the `verification` table with a 10-minute TTL, verify on sign-in
- **Login UI change:** two-step form — step 1: enter email → step 2: enter OTP code. The current `emailAndPassword` plugin can be kept enabled in parallel so the password-based login remains as a fallback until OTP is confirmed working.

**Schema:** No migration needed — better-auth reuses the existing `verification` table.

---

### Sub-task 9d — Admin setup: register master email

**File:** `src/worker/routes/admin.ts` (`POST /api/admin/setup`)

The setup endpoint already creates the first user. Small additions:
- Accept a `recoveryEmail` field (can be the same as `email` or a separate address).
- Store it in a one-row `app_config` table (`key TEXT PRIMARY KEY, value TEXT`) — migration `0001_app_config.sql`.
- The existing `ADMIN_RESET_SECRET` flow remains. Add a new `POST /api/viewer/admin/recover-by-email` route that sends a password-reset / OTP email to the stored recovery email, so recovery doesn't require accessing Cloudflare dashboard.

---

### Sub-task 9e — Per-gallery email whitelist

**New table:** `gallery_allowed_emails (id, gallery_id FK, email, added_at)` — migration `0001_app_config.sql` (same migration as above).

**API routes (admin-only):**
- `GET /api/admin/galleries/:id/allowed-emails` — list allowed emails
- `POST /api/admin/galleries/:id/allowed-emails` — add an email; immediately sends the invited viewer an onboarding email with the gallery link
- `DELETE /api/admin/galleries/:id/allowed-emails/:email` — remove access

**Viewer auth change (`POST /api/viewer/gallery/:slug/login`):**
- Existing password flow is unchanged.
- Add an alternative path: if the gallery has any rows in `gallery_allowed_emails`, also accept `{ email }` with no password → generate a viewer OTP code stored in `verification`, send it via Resend, return `{ requiresOtp: true }`. A second call `POST /api/viewer/gallery/:slug/verify-otp` with `{ email, otp }` verifies the code and issues the viewer JWT cookie.
- Public galleries remain fully open (no change).

---

### Sub-task 9f — Admin user invitations

**API route (admin-only):** `POST /api/admin/users/invite`
- Accepts `{ email, name }`.
- Creates a user in better-auth with a random placeholder password and `emailVerified: false`.
- Sends the onboarding email via Resend with a magic link (better-auth `POST /api/auth/sign-in/magic-link` or a custom token stored in `verification`) so the invitee clicks once to land in the admin dashboard already signed in, then sets their own password.
- The invited user appears in an `GET /api/admin/users` list.

---

### Sub-task 9g — Photo upload notifications

**File:** `src/worker/routes/images.ts` (the upload handler)

After a photo is successfully inserted:
- Query `gallery_subscribers WHERE gallery_id = ? AND verified = 1`.
- If any exist, fire a single `waitUntil` (non-blocking) send to each via Resend with the new-photos template.
- Batch intelligently: if multiple photos are uploaded in one session, debounce by storing a pending-notify flag rather than sending one email per photo. For the initial implementation, a simpler approach is fine: send once per upload request (which may contain multiple files).

---

### Sub-task 9h — Gallery expiry warning emails

**Trigger:** Can be a Cloudflare Cron Trigger (add `[triggers] crons = ["0 9 * * *"]` to `wrangler.jsonc`) or triggered lazily on the first gallery fetch after the expiry window opens. The cron approach is cleaner.

On schedule:
- Query galleries where `expires_at BETWEEN now AND now + 7 days AND deleted_at IS NULL`.
- For each, send the expiry warning email to all verified subscribers.

---

### Miscellaneous (Stage 9)

- [ ] Set real `RESEND_API_KEY` in production via `npm run secrets:push`
- [ ] Add `FROM_EMAIL` binding (the "from" address must be a verified Resend domain) to `wrangler.jsonc` and `Bindings`
- [ ] `dedicated lightbox route` `/gallery/:slug/photo/:id` — deep-linkable URL that opens the lightbox directly; useful for sharing individual photos via the new email notifications

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

