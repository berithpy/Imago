# Future Work

---

## Scheduled Worker (Cron Jobs)

Cloudflare Workers supports a `scheduled` handler triggered by cron expressions in `wrangler.jsonc`. This is the right place for all deferred and time-based work — no external job queue needed. The scheduled worker should be set up before any of the email notification work below, since notifications depend on it.

### Deletion pipeline

Soft deletes are already in place for galleries and tenants. The scheduled worker should carry out the actual permanent purge after a grace period (30 days is a reasonable default).

- Galleries past the grace period should have their photos removed from both D1 and R2, then the gallery row itself deleted. Each purge should be logged with the gallery id, tenant id, and object count so the job is auditable.
- Tenant deletion cascades through their galleries first — R2 cleanup happens at the gallery level so nothing is orphaned. Once all galleries are purged, the tenant row, its associated organization, and all member rows are removed.

### R2 orphan audit

R2 objects can accumulate without a matching DB row if an upload partially succeeds or if a past deletion had a bug. The scheduled worker should periodically list R2 objects and cross-check them against the `photos` table, flagging or removing any keys that have no corresponding row. This should run less frequently than the deletion pipeline — weekly is fine — since it is read-heavy and burns R2 list-operation quota.

### Subscriber upload notifications

When a tenant uploads photos to a gallery, any verified subscribers for that gallery should receive an email letting them know new photos are available. The key constraints are:

- **No spam.** Subscribers should receive at most one notification email per gallery per day, regardless of how many uploads happen. If a photographer uploads ten photos across the morning, a single daily digest email goes out — not ten.
- **No slowdown.** Sending email must not happen inline with the upload request. The upload route should record that a notification is pending (e.g. update a `last_upload_at` timestamp on the gallery), and the scheduled worker handles the actual send during its daily run.
- **Only galleries with subscribers.** If a gallery has no verified subscribers, no email is sent and no work is done.

The daily cron should find all galleries where photos were uploaded since the last notification was sent, collect their verified subscriber emails, and dispatch a single Resend batch call per gallery. After sending, record the time so the same gallery is not notified again until the next upload.

---

## Email & Notifications

The email sending layer (`src/worker/lib/email.ts`) is currently stubbed. Before any of the notification features below can work, the Resend integration needs to be completed — the API key is already set in `.dev.vars` and `.prod.vars`, the function just needs to make the real API call.

Once that is done, the following flows should be wired up:

### Subscription opt-in and opt-out

The subscribe and unsubscribe routes already generate tokens and write DB rows, but the confirmation emails are never sent. These two emails are simple transactional sends — inline with the request is fine since they are low-volume and user-initiated.

- Subscription confirmation: send a "confirm your subscription" email with the verify link.
- Unsubscribe confirmation: send a brief acknowledgement that the address has been removed.

### Gallery expiry warnings

When a tenant soft-deletes a gallery, verified subscribers should receive a warning that the gallery will be permanently deleted on a specific date and that they should download their photos before then. The gallery export URL should be included in the email so they can act immediately. This send can happen inline with the soft-delete request or be deferred — either works since it fires once per gallery.

---

## Tenant Limits & Plans

Multi-tenant apps need guardrails so one tenant cannot consume unbounded resources. The goal is to define sensible per-plan limits and enforce them at the API level without adding a lot of complexity.

### What to limit

- **Galleries per tenant** — unbounded gallery creation is a spam vector even if D1 rows are cheap.
- **Photos per gallery** — controls per-gallery query performance and storage growth.
- **Total storage per tenant** — the real cost driver since R2 charges per GB stored.
- **Allowed-email entries per gallery** — prevents using Imago as an email harvesting tool.
- **Subscribers per gallery** — controls Resend usage since email sends cost money.

### Schema additions needed

- A `plan` column on the `tenants` table (e.g. `free`, `pro`) with a default of `free`.
- A `tenant_limits` table with one optional row per tenant for super-admin overrides — nullable columns mean "use the plan default". Per-tenant overrides win over plan defaults.
- A `size_bytes` column on `photos` so storage totals can be computed with a simple SUM query rather than hitting R2.

### Enforcement

Limits should be checked at the application level immediately before the relevant insert — count rows or sum bytes, compare to the limit, and return a clear error if the limit is reached. A `402` status with a body explaining what limit was hit and what the current usage is gives the frontend enough information to show a useful message. Hard DB constraints are not the right place for this since their errors are opaque and untestable.

### Usage display

The tenant admin dashboard should show a usage summary — galleries used out of the allowed maximum, and storage used out of the allowed maximum. The super-admin dashboard can show a per-tenant usage summary in the tenant list. This requires a usage endpoint on the tenant admin API that runs the relevant COUNT and SUM queries.

### Periodic storage reconciliation

Storage byte counters can drift if photos are deleted without the counter being decremented. The scheduled worker should include a periodic pass that recalculates storage totals from the `photos` table and corrects any drift. This can run weekly alongside the orphan audit.

---

## Client Feedback and Rating Workflow

Some galleries are not just for delivery, they are part of a selection process. A tenant may want to share a work-in-progress gallery with a client and ask for feedback before final delivery. Imago should support a lightweight review flow for email viewers so they can quickly mark photos and the photographer can see those choices inside the gallery tools.

### Photo rating / selection

The main use case is a simple per-photo choice such as `good`, `bad`, or `unrated`. This needs to be easy to use from both the grid view and the lightbox so viewers can move quickly through a gallery and leave feedback without extra friction.

Ratings should be stored per photo and per email viewer. A photo only belongs to one gallery, so the rating naturally lives on the photo within that gallery context. This keeps the review model simple while still allowing multiple clients or stakeholders to review the same gallery independently.

There is no need for vote history in the first version. Each email viewer has a current vote for each photo, and if they change their mind later, the latest vote simply replaces the previous one.

Only email viewers should be able to leave votes. This keeps the review workflow tied to the client-facing gallery access model instead of turning it into a generic public voting feature.

### Ratings visible at a glance

Ratings should be visible directly in the gallery management experience so a photographer can scan a gallery and immediately understand what is being selected, rejected, or still undecided. The review state should not be buried inside a details screen.

This also implies gallery-level summaries such as:

- how many photos are marked `good`
- how many are marked `bad`
- how many are still unrated
- how many have disagreement between viewers

Tenant admins should be able to inspect both the aggregate state and, when needed, who voted for what. That per-viewer detail does not need to be visible all the time, but it should be available on demand.

Disagreement should be treated as its own meaningful state, not just a detail hidden inside the vote list. If a photo has both positive and negative votes, it should be visibly marked as disputed so the photographer can identify it at a glance.

### Filter by rating

Once ratings exist, the gallery tools should support filtering by them. A photographer should be able to quickly switch between views like `all`, `good`, `bad`, `neutral`, and `disagreement` so the review process becomes actionable instead of just decorative.

Filtering matters as much as the rating itself. Without it, the value of the feature drops sharply on larger galleries.

The `disagreement` filter should contain photos that have both positive and negative votes. Those same photos should still appear in `neutral`, because they are not clean selections in either direction and still need attention. In other words, disagreement is not exclusive of neutral; it is a special unresolved case within it.

Photos in this state should have a clear indicator that they are both liked and disliked.

These same filters should also apply to exports so a photographer can export only the selected photos, only the rejected photos, or only the unrated set depending on the workflow they are using.

### Rate from the lightbox

The lightbox is where people inspect one image closely, so it should also be a place where they can leave feedback. Rating only from the grid would feel incomplete and force extra navigation.

The grid and lightbox should feel like two entry points into the same review workflow, not two separate systems.

For viewers, their own vote should be visible in both places. Other viewers' votes should be hidden by default from viewers, even if the system stores them. If there is ever a collaborative review mode later, that can be introduced deliberately rather than being the default behavior.

### Comments as a second phase

Comments on galleries and on individual photos are a natural extension of the rating workflow, but they are lower priority than simple voting. The first milestone should focus on quick structured feedback. Free-form comments can come later once the rating flow is clear and working well.

Comments still belong in this feature area because they solve the next layer of the same problem: not just `which image do you like`, but `why`.

### Product questions still to solve

The main product shape is now clear, but a few details still need to be decided:

- **Viewer identity source** — ratings are tied to email viewers, but the exact identity key still needs to be defined cleanly so repeat access maps back to the same person reliably.
- **Admin visibility by default** — tenant admins should be able to inspect who voted for what, but it still needs a clear UX decision on whether the default state shows the aggregate first or the detailed voter list first.
- **Viewer visibility controls** — other viewers' votes should be hidden by default, but it is still worth deciding whether some galleries should optionally expose shared voting to all participants.
- **Export behavior** — exports should respect rating filters, but the exact export options still need to be defined clearly in the admin flow.

This is a strong feature block and it fits the product well. The only real caution is to keep phase one narrow: quick ratings first, comments second.

---

## Invitation Flow for Tenant Admins

When a super-admin creates a new tenant, the first admin user for that tenant should receive an invitation email instead of having credentials created manually. The `invitation` table already exists in the schema from better-auth and can be used to implement this flow. The email should contain a link to set a password or accept the invitation, and the registration should be gated to that email address.

---

## Per-Gallery Password Rotation

Allow tenant admins to change a gallery password without immediately invalidating all existing viewer sessions and bookmarks. Implement a grace period where both the old and new password hashes remain valid for authentication. After the grace period expires, only the new password works. This gives viewers time to update their bookmarks or receive a notification email about the change.

---

## Workers KV for Subscribers

If subscriber counts grow large and D1 write contention becomes a problem on high-traffic galleries, consider moving subscriber storage to Workers KV. This is a scaling optimization, not a current concern at the app's current scale. It would trade D1 transactional guarantees for KV's lower latency and higher write throughput.

