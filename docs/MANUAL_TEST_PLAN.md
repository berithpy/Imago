# Manual Test Plan
---

## Test Environments

Run the suite in both environments when possible.

| Environment | Base URL | Notes |
|---|---|---|
| Local | `http://localhost:5173` | Vite frontend proxies `/api/*` to Wrangler on `localhost:8787` |
| Production | `https://imago.berith.moe` | Real delivery path, real cookies, real emails |

---

## Prerequisites

### Local

```bash
npm install
npm run setup:dev
npm run db:migrate:local
npm run worker:dev
npm run dev
```

For real magic-link testing locally, `.dev.vars` must contain valid values for:

- `RESEND_API_KEY`
- `FROM_EMAIL`
- `APP_URL=http://localhost:5173`

### Production

Confirm these are already correct:

- `APP_URL=https://imago.berith.moe`
- Resend sender is valid
- latest deploy is live

---

## Required Test Data

Prepare or confirm the following before starting:

| Label | Description |
|---|---|
| Admin email | The real admin email stored in the app |
| Non-admin email | A second email that is not the admin account |
| Whitelisted viewer email | An email added to a private gallery's allow-list |
| Non-whitelisted viewer email | An email not added to that gallery |
| Private gallery | A gallery with `is_public = 0` and a known password |
| Public gallery | A gallery with `is_public = 1` |
| Gallery password | Known valid password for the private gallery |

Suggested gallery fixtures:

- `private-gallery` for password + allow-list checks
- `public-gallery` for anonymous access checks

---

## Test Rules

Use these rules every time so results stay comparable.

1. Run each environment in a fresh incognito/private browser window.
2. Use a second browser profile or a second incognito window when you need to click emailed links without disturbing the original page state.
3. Clear cookies between unrelated auth scenarios unless the case explicitly requires an existing session.
4. Record pass/fail and any exact error text shown in the UI.
5. If a case fails, capture the URL, visible message, and whether cookies were present.

---

## Smoke Checklist

These are the minimum cases to run before any deploy.

| ID | Case | Local | Prod |
|---|---|---|---|
| S1 | Admin login with real admin email | Yes | Yes |
| S2 | Admin login with non-admin email shows same confirmation UI | Yes | Yes |
| S3 | Gallery magic link with whitelisted email | Yes | Yes |
| S4 | Gallery password login with correct password | Yes | Yes |
| S5 | Gallery password login with wrong password | Yes | Yes |
| S6 | Public gallery loads without login prompt | Yes | Yes |
| S7 | Auth pages share the same card shell and work on mobile width | Yes | Yes |
| S8 | Magic-link URL host matches environment | Yes | Yes |

---

## Full Manual Cases

### MT-01 Admin setup on a fresh environment

Run this only on a new local DB or brand-new deployment.

Preconditions:
- no admin user exists

Steps:
1. Open `/admin/setup`.
2. Enter name, admin email, password, and optional recovery email.
3. Submit the form.

Expected:
- success state is shown
- redirect to `/admin/login` happens automatically
- repeating setup later should fail with a clear error or refusal

### MT-02 Admin login with valid admin email

Preconditions:
- admin user exists
- inbox is accessible

Steps:
1. Open `/admin/login`.
2. Enter the admin email.
3. Submit the form.
4. Confirm the `Check your inbox` state appears.
5. Open the email and click the magic link.

Expected:
- confirmation UI appears immediately after submit
- email arrives
- clicking the link lands on `/admin`
- admin dashboard loads successfully

### MT-03 Admin login with non-admin email

Steps:
1. Open `/admin/login`.
2. Enter a non-admin email.
3. Submit the form.

Expected:
- same `Check your inbox` UI appears
- no account existence leak in the UI
- no email is actually sent
- app does not crash or redirect unexpectedly

### MT-04 Gallery magic link with whitelisted email

Preconditions:
- private gallery exists
- test email is on the gallery allow-list

Steps:
1. Open `/gallery/<private-slug>` in a fresh session.
2. Confirm the login page appears.
3. Enter the whitelisted email.
4. Submit the form.
5. Click the emailed magic link.

Expected:
- confirmation UI appears
- email arrives
- clicking the link lands on `/gallery/<private-slug>`
- gallery content loads

### MT-05 Gallery magic link with non-whitelisted email

Steps:
1. Open `/gallery/<private-slug>`.
2. Enter an email not on the allow-list.
3. Submit the form.

Expected:
- inline field error is shown
- no email is sent
- user remains on the login page

### MT-06 Gallery magic link expired or invalid link

Use one of these methods:

- wait until the token expires
- reuse an already-consumed link if better-auth invalidates it after first use
- tamper with the token manually in the URL

Steps:
1. Trigger a gallery magic link.
2. Open it after expiration or with an invalid token.

Expected:
- an error page or clear failure state is shown
- app does not crash
- user can recover by requesting a new link

### MT-07 Gallery password login with correct password

Steps:
1. Open `/gallery/<private-slug>`.
2. Choose `Use a password instead`.
3. Enter the correct gallery password.
4. Submit.

Expected:
- redirect to `/gallery/<private-slug>`
- gallery content loads
- refresh still works while the viewer cookie remains valid

### MT-08 Gallery password login with wrong password

Steps:
1. Open `/gallery/<private-slug>`.
2. Switch to password mode.
3. Enter an invalid password.
4. Submit.

Expected:
- inline error is shown
- no redirect occurs
- user can retry without reloading

### MT-09 Public gallery access

Steps:
1. Open `/gallery/<public-slug>` in a fresh session.

Expected:
- gallery loads directly
- no login prompt appears

### MT-10 Admin bypass into a private gallery

This is not called out in Stage 9d, but it is a real auth path and should be covered manually.

Preconditions:
- admin session is active
- private gallery exists

Steps:
1. Stay logged in as admin.
2. Open `/gallery/<private-slug>` in the same browser profile.
3. Confirm the `Enter as admin (skip password)` action is visible.
4. Use it.

Expected:
- bypass succeeds without entering a gallery password
- gallery opens normally
- if the admin session is expired, the bypass should fail cleanly

### MT-11 Magic-link host is correct in local

Steps:
1. Trigger an admin or gallery magic link while running local dev.
2. Inspect the URL in the email.

Expected:
- host uses `localhost:5173`
- path goes through `/api/auth/magic-link/verify`

### MT-12 Magic-link host is correct in production

Steps:
1. Trigger an admin or gallery magic link in production.
2. Inspect the URL in the email.

Expected:
- host uses `imago.berith.moe`
- link targets the deployed app, not localhost or a workers.dev fallback

### MT-13 Shared login page shell consistency

Pages:

- `/admin/setup`
- `/admin/login`
- `/gallery/<private-slug>` login page

Check:

1. Same card width and centered layout.
2. `Imago` wordmark appears consistently.
3. Buttons and inputs share the same sizing and visual treatment.
4. Errors render inline and remain readable.
5. Loading states disable or dim the action buttons.

Expected:
- the three pages feel like one product surface, not three separate implementations

### MT-14 Mobile auth layout

Viewport:

- `390 x 844` or similar mobile width

Steps:
1. Repeat quick checks on `/admin/login` and `/gallery/<private-slug>`.
2. Trigger at least one validation or auth error.

Expected:
- form remains fully visible
- no horizontal overflow
- buttons stay tappable
- error messages do not overlap controls

---

## Result Template

Use this for each run.

```md
# Manual Test Run

- Date:
- Environment: local | production
- Build/commit:
- Tester:

## Results

| ID | Result | Notes |
|---|---|---|
| MT-02 | PASS | |
| MT-03 | PASS | |
| MT-04 | FAIL | Non-whitelisted email showed generic network error instead of field error |

## Bugs Found

- None
```

---

## Suggested Execution Order

For the shortest useful pass:

1. MT-02
2. MT-03
3. MT-04
4. MT-05
5. MT-07
6. MT-08
7. MT-09
8. MT-11 or MT-12
9. MT-13
10. MT-14

Run MT-01 only on fresh environments. Run MT-06 when auth or better-auth configuration changes. Run MT-10 whenever admin session behavior changes.