---
id: UI-014
title: Gallery admin photo selection and delete interaction
status: completed
source: ad-hoc
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
Currently, individual photo tiles show star, select, and delete buttons at all times. This creates visual clutter. Gallery management workflows typically involve batch operations rather than deleting photos one-by-one, so we should streamline the interaction model to show actions only when relevant and consolidate destructive actions into a select-then-delete flow.

## Goal
Redesign the photo tile interaction model to:
1. Remove the individual delete button from each tile
2. Show thumbnail and select actions only on hover (desktop) or on long-press (mobile)
3. Enable multi-select via visible toggle
4. Provide a batch delete button that only activates when photos are selected

## Acceptance Criteria
- [x] Delete button removed from individual photo tiles
- [x] Thumbnail (eye/preview) icon appears on hover (desktop) or on long-press (mobile)
- [x] Select checkbox appears on hover (desktop) or on long-press (mobile)
- [x] Star (banner/featured) button remains always visible
- [x] Use `useLongPress` hook from https://usehooks.com/uselongpress for mobile long-press detection
- [x] Long-press duration is default (typically 300-500ms) with tactile/visual feedback
- [x] Use Lucide icons (https://lucide.dev/) for all actions:
  - `Eye` or `EyeOpen` for thumbnail/preview
  - `CheckCircle` or `Check` for select
  - `Star` for banner toggle
- [x] Selected tiles have a visual indicator (border/opacity/highlight)
- [x] Batch delete button shows "Delete (X)" and is disabled when no photos selected
- [x] Mobile: long-press duration includes visual countdown or haptic feedback if available
- [x] Desktop: hover state is clear and visually distinct

## Notes
**Files to modify:**
- `src/client/components/gallery-management/PhotoGrid.tsx` — Render action buttons conditionally, add batch delete button
- `src/client/components/gallery-management/PhotoTile.tsx` (or inline tile component) — Wire up hover states and long-press detection

**Dependencies:**
- Add `usehooks` package (or use `use-long-press` if available on npm) for long-press detection
- Use Lucide React icons: `lucide-react` package (likely already installed)

**Interaction design:**
- Desktop hover: Actions fade in over the thumbnail on `mouseenter`
- Mobile long-press: After ~300-500ms of touch, actions appear with a subtle pulse or scale animation
- Long-press should prevent default text selection during detection
- Selected tiles may show a checkmark overlay or border highlight

**Open questions:**
1. Should long-press automatically select the photo, or just reveal actions?
2. Should tapping a tile on mobile (without long-press) open a preview/lightbox, or is that via the eye icon?
3. What's the desired visual feedback during long-press (pulse, scale, color change)?

## Change Log
- 2026-06-27: Implemented in PhotoGrid with hover/long-press action reveal, Lucide icons, and batch delete count label
- 2026-06-27: Created
