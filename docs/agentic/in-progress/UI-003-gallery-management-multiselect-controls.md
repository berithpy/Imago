---
id: UI-003
title: Gallery management multiselect controls
status: in-progress
source: MINOR_UI_ISSUES
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-25
---

## Context
Gallery management needs efficient bulk actions and keyboard workflows.

## Work Item A: Multiselect and bulk actions

### Goal
Add clear selection controls and reliable bulk actions for gallery management.

### Acceptance Criteria
- [ ] Thumbnail controls include delete, star, and select affordances.
- [ ] Selection state supports select-all and select-none actions.
- [ ] Bulk operations target selection only.

## Work Item B: Keyboard navigation and shortcuts

### Goal
Add keyboard-first navigation and selection/action shortcuts for efficient power-user workflows.

### Acceptance Criteria
- [ ] Arrow-key navigation is implemented for gallery management items.
- [ ] Selection and action hotkeys are implemented.
- [ ] Keyboard interactions do not conflict with text inputs or browser-default critical shortcuts.

## Notes
Scope includes thumbnail and gallery-management component modules.
Implement Work Item A first, then Work Item B.