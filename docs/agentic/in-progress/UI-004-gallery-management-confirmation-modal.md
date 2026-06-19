---
id: UI-004
title: Gallery management confirmation modal
status: in-progress
source: MINOR_UI_ISSUES
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-19
---

## Context
Native confirm and alert prompts are inconsistent and hard to style.

## Goal
Use a reusable confirmation modal for destructive and sensitive actions.

## Acceptance Criteria
- [ ] Reusable confirmation modal is implemented and integrated.
- [ ] Deleting pictures uses modal confirmation.
- [ ] Hiding albums uses modal confirmation.
- [ ] Public/private toggle uses confirmation flow.
- [ ] Private-toggle password handling is defined and implemented.

## Notes
May require worker route support for password update behavior.