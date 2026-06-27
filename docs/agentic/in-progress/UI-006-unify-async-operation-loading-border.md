---
id: UI-006
title: Unify async operation loading border treatment
status: in-progress
source: MINOR_UI_ISSUES
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
In gallery settings, async actions do not present a consistent in-progress treatment. Visibility toggle currently uses a highlighted animated loading border (`gm-animated-border` + `border-amber-400`), while password reset relies on button-level loading only.

## Goal
Standardize async status presentation across settings actions (starting with password reset) so long-running operations share the same loading border language as visibility toggle, while preserving per-control visual clarity.

## Acceptance Criteria
- [x] Password reset input applies the same loading border language used by visibility toggle while the request is in flight (animated amber border), without adding an outer container border around all controls.
- [ ] Loading-border styling is extracted into a reusable utility/class composition so multiple async settings sections can adopt it without copy/paste.
- [ ] Reusable API keeps neutral default border and animated/amber loading state parity with current visibility behavior.
- [ ] No behavior regressions in visibility toggle, password reset flow, or disabled/loading interactions.
- [ ] Accessibility semantics are preserved (`aria-busy` where appropriate) and focus/keyboard behavior remains unchanged.

## Notes
Suggested implementation approach:
- Identify current source of truth in `VisibilityToggle` wrapper classes:
  - Base: `px-3 py-2.5 bg-neutral-950 border rounded-lg transition-colors`
  - Loading state: `gm-animated-border border-amber-400`
  - Idle state: `border-neutral-800`
- Extract these into a reusable utility in client UI layer (example: `getAsyncPanelClassName(loading)` in a shared styling helper) or a tiny shared wrapper component (example: `AsyncStatusPanel`).
- Apply the reusable pattern to:
  - Visibility toggle container (replace inline conditional class string).
  - Password reset container (new wrapper around `PasswordField` with `aria-busy` tied to `resettingPassword`).
- Keep scope intentionally narrow to styling + async affordance consistency (no API changes).

Test/verification direction:
- Manual: trigger visibility toggle and password reset, verify matching animated border behavior and state transitions.
- Unit/UI test (optional but preferred): assert reusable helper returns expected class set for loading vs idle.

## Change Log
- 2026-06-24: Created
- 2026-06-27: Switched password reset treatment from section-level border to input-level border for cleaner mobile/desktop layout while keeping the same async loading language.