# Imago  Project Plan

## Stage 1  Project Scaffolding & Configuration

- [x] Bootstrap with `npm create cloudflare@latest` (Vite + React template)
- [x] Configure `wrangler.jsonc` with bindings: `IMAGES_BUCKET` (R2), `DB` (D1), `IMAGES` (Cloudflare Images)
- [x] Add secrets to `.dev.vars`: `JWT_SECRET`, `BETTER_AUTH_SECRET`, `ADMIN_RESET_SECRET`, `RESEND_API_KEY`
- [x] Run `wrangler d1 create` for the database
- [x] Run `wrangler r2 bucket create` for image storage

---

## Stage 2  D1 Schema & Migrations

- [x] App tables  versioned SQL migrations in `migrations/` for: `galleries`, `photos`, `gallery_subscribers`
- [x] better-auth tables  `user`, `session`, `account`, `verification` (migration `0002_better_auth.sql`)
- [x] Admin user seeded once via a protected `POST /admin/setup` endpoint (disabled after first use)
- [x] Migrations applied locally and ready for remote deploy

---

## Stage 3  Hono API: Auth

- [x] Mount better-auth handler at `GET|POST /api/auth/*`
- [x] `requireAdmin` middleware using `auth.api.getSession()` protecting all `/api/admin/*` routes
- [x] `POST /api/viewer/gallery/:slug/login`  PBKDF2-verifies gallery access code, issues viewer JWT cookie
- [x] `requireViewer` middleware checks viewer JWT signature + `galleryId` matches the requested slug
- [x] `baseURL` derived dynamically from request origin (works locally and in production)

---

## Stage 4  Hono API: Gallery, Upload & Image Routes

- [x] `GET /api/admin/galleries`  list all galleries
- [x] `POST /api/admin/galleries`  create gallery (PBKDF2-hash password, store in D1)
- [x] `DELETE /api/admin/galleries/:id`  cascade delete photos from D1 + R2
- [x] `GET /api/admin/galleries/:id/photos`  list photos for admin gallery view
- [x] `POST /api/admin/galleries/:id/photos`  stream upload to R2, insert row in D1
- [x] `DELETE /api/admin/galleries/:galleryId/photos/:photoId`  remove from R2 + D1
- [x] `GET /api/galleries/:slug/photos`  paginated photo list (requires viewer JWT)
- [x] `GET /api/images/:key`  fetch from R2, transform via Cloudflare Images binding (WebP thumbnails), stream with cache headers

---

## Stage 5  Hono API: Subscribe Routes

- [x] `POST /api/subscribe/galleries/:slug`  double opt-in subscribe (upserts subscriber row)
- [x] `GET /api/subscribe/confirm?token=`  verifies email token, sets `verified = 1`
- [x] `GET /api/subscribe/unsubscribe?token=`  removes subscriber row

---

## Stage 6  React Frontend

- [x] `/admin/setup`  one-time admin account creation form
- [x] `/admin/login`  better-auth `signIn.email()` client call
- [x] `/admin`  gallery manager: create/delete galleries, navigate to gallery view
- [x] `/admin/galleries/:id`  photo grid with upload (multi-file + progress) and per-photo delete
- [x] `/gallery/:slug/login`  viewer password form (custom JWT flow)
- [x] `/gallery/:slug`  masonry photo grid (resized WebP thumbnails), lightbox, subscribe input

---

## Stage 7  Things to do BEFORE launch

- [x] Implement infinite scroll for large galleries (cursor-based pagination already exists on the API; add `IntersectionObserver` sentinel in `GalleryView` to auto-trigger `loadMore` instead of a button)
        Invisible pagination like infinite scroll is fine since we don't expect huge galleries, but we should add `?page=` and `?limit=` support to the API and frontend and then "virtualize it?" not sure what the propper term is
- [x] Add loading states and error handling in the React app (currently minimal)
- [x] Add soft delete which hides gallery from viewers but allows admin to export it
    - [x] `deleted_at` column (migration `0003`); admin `DELETE /api/admin/galleries/:id` sets it; `POST .../restore` clears it; `DELETE .../permanent` truly purges
    - [x] Public gallery/photo API filters `WHERE deleted_at IS NULL`
    - [x] Admin dashboard shows HIDDEN badge, Hide / Restore / Delete forever actions
- [x] Add export functionality for viewers and admins
    - [x] Return photo list with `/api/images/:key?variant=full` URLs from `GET /api/galleries/:slug/export` (viewer JWT) and `GET /api/admin/galleries/:id/export` (admin)
    - [x] Client uses `fflate` + File System Access API (`showSaveFilePicker`) to stream each photo directly into a zip saved to disk — falls back to Blob anchor download on unsupported browsers
- [x] Study components and make reusable ones to reduce code duplication
    - [x] `Spinner` / `SpinnerOverlay` — animated loading indicator
    - [x] `ErrorMessage` / `FieldError` — consistent error display with optional retry
    - [x] `EmptyState` — empty list state with optional action
    - [x] `ui.ts` — shared style constants (card, input, buttons) used across all pages
- [x] Add hero banner  allow admin to mark a picture as favourite to use as banner and thumbnail
    - [x] `banner_photo_id` FK column (migration `0003`); toggled via `PATCH /api/admin/galleries/:id/banner`
    - [x] ★ button overlay on each photo card in `AdminGallery` (gold when active)
    - [x] `GalleryView` renders full-width banner image at top when set
- [x] Allow public galleries that don't require login
    - [x] Add `is_public` to gallery schema (migration `0003`), toggle in admin UI (🌐/🔒 button in `AdminGallery`, checkbox in create form)
    - [x] If `is_public`, skip password check in `POST /api/viewer/gallery/:slug/login`
    - [x] `GalleryIndex` routes public galleries directly to view (no login form); shows PUBLIC badge
    - [x] `GalleryView` auto-issues viewer JWT for public galleries on load

---

## Stage 8  Polish & Deployment

- [x] `tsc --noEmit` passes clean
- [x] `vite build` passes
- [x] `README.md` and `DEPLOY.md` written
- [x] Production secrets generated and stored in `.prod.vars`
- [x] `wrangler d1 migrations apply imago-db --remote`
- [x] `wrangler secret put` for all four secrets
- [x] `wrangler deploy`
- [x] Custom domain setup
- [x] End-to-end testing in production

---

## Stage 9  Future Features

- [ ] Wire up Resend to actually send confirmation emails (stubbed with TODO)
- [ ] Add email list associated to gallery so that we can tell them when we plan to "delete" them
- [ ] Set up Resend API key in production (`RESEND_API_KEY` in `.prod.vars` is still a placeholder — subscribe/unsubscribe confirmation emails won't work until this is set via `npx wrangler secret put RESEND_API_KEY`)
- [ ] Trigger email notifications to verified subscribers on photo upload
- [ ] `/gallery/:slug/photo/:id`  dedicated lightbox route (currently handled inline in GalleryView)
- [ ] Consider Workers KV for subscriber storage if D1 performance becomes an issue

---

### Feature Request — Multitenancy (future)

To turn Imago into a multi-tenant SaaS (multiple photographer accounts, each isolated), these are the steps:

#### 1. Data model changes (migrations)
- Add a `tenants` table: `id`, `name`, `slug`, `created_at`.
- Add `tenant_id` FK column to `galleries`, `photos`, `gallery_subscribers`, and the better-auth `user` table (or use better-auth's built-in `organization` plugin).
- All queries must be scoped with `WHERE tenant_id = ?`.

#### 2. Auth & routing changes
- Decide on tenant resolution strategy:
  - **Subdomain:** `alice.imago.app` → extract `alice` from `Host` header in the worker and resolve `tenant_id`.
  - **Path prefix:** `/t/alice/gallery/...` — simpler to implement, no DNS wildcard needed.
  - **Custom domain per tenant:** store a `custom_domain` column on `tenants` and match against `Host` header.
- Add `requireTenant` middleware that resolves and injects `tenantId` into Hono context.
- Update `requireAdmin` and `requireViewer` to also verify the resolved tenant matches the resource.

#### 3. Tenant onboarding
- Add `POST /api/tenants` (super-admin only) or a self-serve sign-up flow.
- Seed a per-tenant admin user (extend or reuse the `/admin/setup` endpoint, gated by tenant).

#### 4. Storage isolation
- R2 keys should be prefixed with `tenant_id/` (e.g. `t_abc123/gallery_xyz/photo.jpg`) so tenant data is logically separated in the same bucket.
- Alternatively, provision a separate R2 bucket per tenant (more isolation, harder to manage).

#### 5. Frontend changes
- The React app needs to be tenant-aware: read the current tenant from the URL/subdomain and pass it with every API request.
- Admin and viewer login pages need tenant context.

#### 6. Billing / limits (optional)
- Add a `plan` column to `tenants` and enforce limits (max galleries, max photos, max storage) in the relevant API routes.