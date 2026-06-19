---
id: UI-005
title: Mobile lightbox control layout safety
status: in-progress
source: MINOR_UI_ISSUES
area: lightbox
priority: high
depends_on: []
updated: 2026-06-19
---

## Context
On mobile lightbox view, the image counter and action controls overlap each other and can render over the image content, reducing clarity and tap reliability.

## Goal
Rework mobile lightbox spacing and control placement so all controls stay readable, tappable, and visually separated from each other and from photo content.

## Acceptance Criteria
- [ ] Mobile-only lightbox layout applies additional outer padding/margins so controls render outside the image frame.
- [ ] Image viewport is inset to preserve dedicated top and bottom control zones.
- [ ] Counter and action buttons no longer overlap at common mobile breakpoints.
- [ ] Touch targets for mobile controls remain at least 44x44 CSS pixels.
- [ ] Layout respects safe-area insets (for notches/home-indicator areas) and remains usable in portrait and landscape.
- [ ] Desktop and tablet lightbox layouts are unchanged.

## Notes
Implementation direction:
- Use a mobile breakpoint-specific container layout that separates top bar (counter/close) and bottom bar (actions).
- Anchor bars using container padding and safe-area values rather than overlaying directly on image bounds.
- Keep actions on a dedicated row/group so they cannot collide with counter text as labels change.
- Validate on narrow widths around 320px to 430px and at least one landscape mobile width.
- If needed, reduce icon+label density on mobile (icon-only or condensed labels) while preserving accessibility names.

## Change Log
- 2026-06-19: Created