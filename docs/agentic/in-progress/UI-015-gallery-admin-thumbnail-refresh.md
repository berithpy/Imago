---
id: UI-015
title: Gallery admin thumbnail refresh with info chips
status: completed
source: ad-hoc
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
Currently, the gallery admin photo grid shows thumbnails with filename and file size displayed as text below each image. This is inconsistent with the viewer gallery, which uses conditional info "chips" overlaid on top of the image. The admin view should adopt the same chip pattern for a more polished, unified design.

## Goal
Refresh the gallery admin thumbnail display to show image-only cards with optional info chips (position counter, filename, file size) that appear on top of the image when toggled, matching the viewer gallery UX pattern. Use sharp borders instead of rounded corners.

## Acceptance Criteria
- [x] Remove filename and file size text below thumbnails in PhotoGrid
- [x] Add sharp borders to thumbnails (no border-radius)
- [x] Add an "Info" toggle button (styled like viewer gallery) to show/hide info chips
- [x] Info chips display on top of the image when toggled on, showing:
  - Position counter (e.g., "1/50") in top-right
  - Filename in bottom-left
  - File size in bottom-right
- [x] Use the same badge styling as GalleryView (monospace font, semi-transparent black background, `rounded` class for small radius)
- [x] Pass `index`, `total`, `filename`, and `size` props to PhotoThumbnail for chip rendering
- [x] Info toggle state persists across grid mode changes (list/small-grid/grid)
- [x] Responsive: on mobile, info toggle remains accessible and chips remain readable

## Notes
**Files to modify:**
- `src/client/components/gallery-management/PhotoGrid.tsx` — Add info toggle state and pass chip props to PhotoThumbnail
- `src/client/components/PhotoThumbnail.tsx` — Add file size chip; accept and conditionally render all three chips

**Design reference:**
- See `src/client/pages/GalleryView.tsx` for the info toggle button and chip rendering pattern
- Badge styling uses: `bg-black/55 text-[0.7rem] font-medium px-1.5 py-0.5 rounded text-white pointer-events-none` with monospace font

**Chip positioning:**
- "1/50" counter → top-right (using `top-1.5 right-1.5`)
- Filename → bottom-left (using `bottom-1.5 left-1.5`, truncated)
- File size → bottom-right (using `bottom-1.5 right-1.5`)

**Open question:** Should the info state be per-gallery (persisted in URL/localStorage) or just session state?

## Change Log
- 2026-06-27: Implemented admin grid info toggle/chips and sharp-corner thumbnails to match viewer pattern
- 2026-06-27: Created
