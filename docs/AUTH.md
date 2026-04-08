# Auth Architecture

Imago uses two separate auth systems in parallel. Understanding the boundary between them is key to tracing any login issue.

---

## The two systems

### 1. better-auth session (cookie: `better-auth.session_token`)

Used for **admin users** and **gallery viewers who sign in via magic link**.

- Managed entirely by [better-auth](https://better-auth.com), mounted at `/api/auth/*`
- Session cookie is `httpOnly`, `sameSite=lax`, `secure` in production only
- Session lifetime: 30 days, rolling — expiry resets once per day on activity
- Cookie cache: 24 h (reads from cookie without hitting DB on every request)
- The single better-auth instance is created per-request in `src/worker/lib/auth.ts` because the Cloudflare Workers env is only available at runtime

Plugins enabled:
- **`magicLink`** — 10-min token, sent via Resend. Used by both admin login and gallery viewer login
- **`emailOTP`** — still configured (used by the emergency recovery-by-email flow); not exposed on any login UI

### 2. Viewer JWT cookie (`viewer_token`)

Used for **gallery viewers who authenticate with a gallery password**, and for the **admin bypass** shortcut.

- Signed with `JWT_SECRET` using HS256 via `hono/jwt`
- Payload: `{ sub: "viewer", galleryId: string, exp: number }`
- Lifetime: 24 h, non-rolling
- Cookie: `httpOnly`, `sameSite=Lax`, `secure: false` (hardcoded — fix in a future cleanup to mirror better-auth's `isProd` check)
- Issued by two routes:
  - `POST /api/viewer/gallery/:slug/login` — verifies PBKDF2 password hash
  - `POST /api/admin/galleries/:id/viewer-bypass` — admin session required; issues token without a password

---

## Auth flows

### Admin setup (one-time)

**Trigger:** `GET /admin/setup`, when no admin user exists yet  
**Page:** `AdminSetup.tsx`

```
User fills name + email + password
  → POST /api/admin/setup
      ├─ Checks: SELECT id FROM user LIMIT 1  →  403 if row exists
      ├─ Calls: auth().api.signUpEmail({ email, password, name })
      ├─ Stores recovery_email in app_config
      └─ Returns { ok: true }
  → Redirects to /admin/login after 2 s
```

**Cookies set:** none (setup does not create a session)  
**Error cases:** 403 if setup already done; validation errors from better-auth

---

### Admin login (magic link)

**Trigger:** `GET /admin/login`  
**Page:** `AdminLogin.tsx` → `LoginCard`

```
User enters email
  → POST /api/viewer/admin/magic-link
      ├─ Checks: SELECT email FROM user LIMIT 1
      ├─ If email matches → auth().api.signInMagicLink({ email, callbackURL: "/admin" })
      │    └─ better-auth sends email via Resend containing a one-time link
      └─ Always returns { ok: true }  (no info leakage if email doesn't match)

User clicks link in email
  → GET /api/auth/magic-link/verify?token=...
      └─ better-auth verifies token, sets better-auth.session_token cookie
      └─ Redirects to callbackURL → /admin
```

**Cookies set:** `better-auth.session_token` (30 days, rolling)  
**Error cases:**
- Wrong email → same confirmation UI shown, no email sent
- Expired link → better-auth returns an error page; user must request a new link

---

### Gallery login — magic link (email whitelist)

**Trigger:** Navigating to a private gallery without a valid cookie, or directly to `/gallery/:slug/login`  
**Page:** `GalleryLogin.tsx` → `LoginCard`

```
User enters email
  → POST /api/viewer/gallery/:slug/magic-link
      ├─ Looks up gallery by slug
      ├─ Checks gallery_allowed_emails for the email  →  403 if not found
      ├─ Calls: auth().api.signInMagicLink({ email, callbackURL: "/gallery/:slug" })
      └─ Returns { ok: true }

User clicks link in email
  → GET /api/auth/magic-link/verify?token=...
      └─ better-auth verifies token, sets better-auth.session_token cookie
      └─ Redirects to callbackURL → /gallery/:slug

On /gallery/:slug, requireViewer middleware:
  → auth().api.getSession() → user.email
  → Checks gallery_allowed_emails again
  → Grants access if email is still on the list
```

**Cookies set:** `better-auth.session_token` (30 days, rolling)  
**Error cases:**
- Email not on whitelist → 403, shown immediately as a field error (no email sent)
- Expired link → better-auth error; user requests a new link

---

### Gallery login — password

**Trigger:** "Use a password instead" toggle on the gallery login page  
**Page:** `GalleryLogin.tsx` → `LoginCard` (password step)

```
User enters password
  → POST /api/viewer/gallery/:slug/login
      ├─ Fetches gallery by slug (password_hash, is_public)
      ├─ Public gallery → skips password check, issues token anyway
      ├─ Private gallery → pbkdf2Verify(password, hash)  →  401 if wrong
      ├─ Signs JWT: { sub: "viewer", galleryId, exp: now+24h }
      └─ Sets viewer_token cookie (httpOnly, Lax, 24 h)
  → navigate(/gallery/:slug)
```

**Cookies set:** `viewer_token` (24 h, non-rolling)  
**Error cases:**
- Wrong password → 401 `{ error: "Invalid password" }`, shown as field error
- Gallery not found → 404

---

### Gallery login — admin bypass

**Trigger:** Admin bypass button on the gallery login page (only visible when a better-auth admin session is detected)  
**Page:** `GalleryLogin.tsx` → `LoginCard`

```
Admin clicks bypass
  → POST /api/admin/galleries/:galleryId/viewer-bypass
      ├─ Admin session guard checks better-auth.session_token  →  401 if missing
      ├─ Signs JWT: { sub: "viewer", galleryId, exp: now+24h }
      └─ Sets viewer_token cookie
  → navigate(/gallery/:slug)
```

**Cookies set:** `viewer_token` (24 h)  
**Error cases:**
- Session expired → 401, shown as bypass button error

---

### Magic link callback (handled by better-auth)

**Trigger:** User clicks a magic link in their email  
**No page file** — handled entirely by better-auth's route at `GET /api/auth/magic-link/verify`

```
better-auth verifies the token
  → Sets better-auth.session_token cookie
  → HTTP 302 redirect to callbackURL
     ├─ /admin  (admin login flow)
     └─ /gallery/:slug  (viewer login flow)
```

---

## `requireViewer` middleware

Applied to all gallery photo/data routes. Resolution order:

```
1. Public gallery (is_public = 1)  →  pass through, no auth needed

2. viewer_token cookie present
   └─ verify(token, JWT_SECRET, "HS256")
   └─ Check sub === "viewer" and payload.galleryId matches slug's gallery id
   └─ Pass through or 401/403

3. better-auth session cookie present
   └─ auth().api.getSession()
   └─ Check gallery_allowed_emails for session user's email
   └─ Pass through or fall to 401

4. No valid auth  →  401
```

`requireViewerOrAdmin` (used on image-serving routes) adds an extra check between steps 1 and 2: a valid admin session always passes through.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET` | Yes | Signs better-auth session tokens. Must be 32+ chars. |
| `JWT_SECRET` | Yes | Signs viewer JWT cookies. |
| `APP_URL` | Yes | Base URL of the app (`https://imago.berith.moe` in prod, `http://localhost:5173` locally). Used as better-auth's `baseURL` and to determine `secure` cookie flag. |
| `RESEND_API_KEY` | Yes | Sends magic link and OTP emails. |
| `FROM_EMAIL` | Yes | Sender address for Resend emails. |
| `ADMIN_RESET_SECRET` | Optional | Enables emergency `/api/viewer/admin/reset` and `/api/viewer/admin/recover` routes. |

---

## Testing magic links locally

Magic link emails contain a URL built from `APP_URL`. In local dev:

- `APP_URL` is `http://localhost:5173`
- Wrangler runs the worker on port 8787; Vite proxies `/api/*` to it
- The link in the email will point to `http://localhost:5173/api/auth/magic-link/verify?token=...`
- Clicking it in your local browser works end-to-end through the Vite proxy

In production, `APP_URL=https://imago.berith.moe` so links point to the live domain.

---

## Cookie summary

| Cookie | Set by | Lifetime | Carries |
|---|---|---|---|
| `better-auth.session_token` | better-auth (`/api/auth/*`) | 30 days rolling | Admin session, viewer magic-link session |
| `viewer_token` | `/api/viewer/gallery/:slug/login`, `/api/admin/galleries/:id/viewer-bypass` | 24 h fixed | Viewer JWT for password/bypass auth |
