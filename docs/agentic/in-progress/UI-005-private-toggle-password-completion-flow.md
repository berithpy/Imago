---
id: UI-005
title: Private toggle password completion flow
status: in-progress
source: MINOR_UI_ISSUES
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-25
---

## Context
Gallery management currently allows an admin to switch a gallery to private without establishing the password needed for viewer access. That creates an easy-to-miss broken state and relies on the admin remembering a second manual step.

## Goal
When an admin tries to make a gallery private, keep the flow inline rather than modal, clearly direct them to the password input, and prevent them from leaving the gallery in a private-without-password state.

## Acceptance Criteria
- [ ] Switching a gallery from public to private requires a password to be set before the change is considered complete.
- [ ] If the admin attempts the private toggle without a valid password present, the UI visibly highlights the password field and explains the required next step.
- [ ] The flow stays inline on the page and does not introduce a modal for password completion.
- [ ] The admin cannot navigate away from the edit flow while the gallery is left in an unresolved private-without-password state caused by that toggle action.
- [ ] Cancelling or backing out of the incomplete change returns the gallery to a valid state.
- [ ] Validation and save behavior remain clear for both creating a new password and updating an existing one.

## Notes
This ticket is intentionally separate from the reusable confirmation modal work in UI-004.

Open design point:
- Confirm whether "cannot leave" should mean blocking route transitions only for the active edit flow, auto-reverting the toggle if abandoned, or both.

Potential implementation direction:
- Treat the private toggle as entering a required completion state until password input passes validation and the change is saved.
- Reuse existing inline validation/error presentation patterns instead of adding a new dialog.

## Change Log
- 2026-06-25: Created by splitting password completion behavior out of UI-004.