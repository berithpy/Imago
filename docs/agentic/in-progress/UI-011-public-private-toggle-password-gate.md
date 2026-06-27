---
id: UI-011
title: Public/private toggle password gate and reset input visibility
status: in-progress
source: ad-hoc
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
Gallery settings currently expose reset-password UI in situations where the gallery is still public. The public-to-private flow also needs clearer optimistic feedback so the admin can see the intended private state immediately while finishing the required password step.

## Goal
Ensure password reset controls are only shown for private or pending-private flows, and make the visibility toggle optimistically reflect private intent until password save finalizes the actual privacy change.

## Acceptance Criteria
- [ ] For fully public galleries with no pending private transition, the reset-password input and related actions are not shown.
- [ ] When an admin toggles from public to private, the UI immediately shows the gallery as private in a pending state (optimistic UI) before backend visibility is committed.
- [ ] During that pending state, the UI clearly indicates that privacy is not finalized until a new password is saved.
- [ ] Saving a valid password in the pending state completes the private transition and persists private visibility.
- [ ] If the admin cancels the pending private flow, the gallery returns to public state in the UI and reset-password controls are hidden again.
- [ ] If password save or private finalization fails, the UI shows an actionable error and remains consistent (no silent mismatch between displayed state and actual saved state).

## Notes
Related completed work: UI-005 captured the first pass of private completion flow. This ticket is a focused behavior correction and UX hardening pass.

Likely touchpoints:
- src/client/components/gallery-management/SettingsPanel.tsx
- src/client/components/gallery-management/PasswordResetSection.tsx
- src/client/components/gallery-management/VisibilityToggle.tsx

Suggested test coverage:
- Add or update component/page tests to verify reset-password visibility gating for public vs pending/private states.
- Verify optimistic toggle presentation and cancel/error rollback behavior.

## Change Log
- 2026-06-27: Created