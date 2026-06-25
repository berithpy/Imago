---
id: UI-007
title: New gallery password handoff and share access copy flow
status: in-progress
source: ad-hoc
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-25
---

## Context
When an admin creates a gallery with password protection, the typed password is currently lost from immediate follow-up actions. This creates extra friction when the next step is sharing viewer access.

## Goal
After creating a password-protected gallery, route directly to that gallery management page and provide a one-click "Share gallery access" action that copies a ready-to-send message including the gallery viewer URL and the password that was just set.

## Acceptance Criteria
- [ ] Creating a gallery always navigates directly to the management page for the newly created gallery.
- [ ] If gallery creation included a password, the app keeps that password temporarily in client state for the immediate post-create flow only.
- [ ] On the destination gallery management page, when a temporary password is present, show a "Share gallery access" button.
- [ ] Clicking "Share gallery access" copies a template message that includes:
- [ ] The gallery viewer URL.
- [ ] The gallery password that was just set during creation.
- [ ] The temporary password is not persisted to long-term storage (database, localStorage, URL, logs) and is cleared after use/refresh/session end.
- [ ] If gallery creation did not include a password, the "Share gallery access" button is not shown.
- [ ] If copy-to-clipboard fails, the UI shows a clear recoverable error state.

## Notes
Suggested copy payload format:
"Gallery access:\n<viewer_url>\nPassword: <password>"

Scope notes:
- This ticket is for immediate post-create handoff UX only.
- This does not change the persistent gallery password model in the backend.

Potential implementation direction:
- Pass ephemeral state on navigation after create (for example, route state) instead of using persistent storage.
- Resolve viewer URL from existing slug/route conventions used by gallery links.

## Change Log
- 2026-06-25: Created
