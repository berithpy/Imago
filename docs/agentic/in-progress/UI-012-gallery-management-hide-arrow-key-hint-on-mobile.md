---
id: UI-012
title: Hide gallery management arrow-key hint text on mobile
status: in-progress
source: ad-hoc
area: gallery-management
priority: low
depends_on: []
updated: 2026-06-27
---

## Context
Gallery management currently shows keyboard guidance that references arrow keys. This helper text is not relevant on mobile/touch devices and creates unnecessary UI noise.

## Goal
Ensure arrow-key helper text is only shown when it is useful, and never shown on mobile viewports.

## Acceptance Criteria
- [ ] On mobile/touch viewports, arrow-key helper text is not rendered in gallery management.
- [ ] On desktop/non-touch viewports, existing arrow-key helper text remains visible with no behavior regressions.
- [ ] Responsive behavior is stable when resizing between mobile and desktop breakpoints.
- [ ] No layout shift or spacing artifacts are introduced when the helper text is hidden on mobile.
- [ ] Existing gallery management selection/navigation flows continue to work as before.

## Notes
Likely implement via viewport-aware conditional rendering near the keyboard hint copy. Keep logic aligned with existing responsive mode gating in gallery management.

## Change Log
- 2026-06-27: Created.
