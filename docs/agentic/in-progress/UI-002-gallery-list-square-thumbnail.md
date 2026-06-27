---
id: UI-002
title: Gallery list square thumbnail
status: done
source: MINOR_UI_ISSUES
area: gallery-list
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
Gallery list relies on names without visual thumbnail cues.

Some galleries contain sensitive photos that should not be previewed accidentally in shared/client-facing environments.

## Goal
Show square gallery thumbnails with backend thumbnail resolution.

Allow galleries to opt out of showing a photo thumbnail in list views.

## Acceptance Criteria
- [ ] Worker endpoint resolves gallery thumbnail photo.
- [ ] Resolution prefers starred thumbnail, fallback to first photo.
- [ ] Gallery list renders square thumbnail per item.
- [ ] Gallery supports an explicit "no thumbnail" list mode for sensitive content.
- [ ] When "no thumbnail" mode is enabled, gallery list renders a neutral square placeholder (no photo fetch).

## Design Decisions

### 1) Keep list semantics, do not switch to a gallery grid
Gallery management remains a row-based list optimized for quick scanning and actions. Adding thumbnails should improve recognition without reducing information density or making the view feel like a browsing grid.

### 2) Three-zone row structure
Each gallery row is structured as:
- Left: fixed square visual tile
- Middle: gallery metadata (name, slug, description, state labels)
- Right: management actions (existing buttons)

This preserves current task flow while adding visual context.

### 3) Stable visual tile states
The visual tile always occupies the same square footprint to avoid row-height jitter. It has three explicit states:
- Photo thumbnail: when previews are allowed and a resolved image exists
- Hidden preview placeholder: when gallery is in explicit sensitive/no-thumbnail mode
- No-photos placeholder: when gallery has no photos

### 4) Privacy state must be explicit and visible
Sensitive behavior is controlled by an explicit gallery setting (not inferred). When enabled, list rows must show a neutral non-photo placeholder and a clear "hidden preview" state so admins can distinguish intentional suppression from missing media.

### 5) Distinguish intent from emptiness
"Hidden preview" and "No photos" are separate states with different labels. This avoids ambiguity and supports correct admin decisions.

### 6) Responsive priority
On small screens, preserve thumbnail + core identity first (tile, name, slug), then flow management actions below as needed. Thumbnail state indicators remain visible in mobile layout.

### 7) Calm interaction model
This is an operational dashboard list, not a portfolio view. Interactions should prioritize clarity and consistency over decorative motion.

## Notes
Reuse existing OpenGraph thumbnail logic where possible.

For privacy, do not infer "no thumbnail" from missing photos. Use an explicit gallery setting so admins can keep photos uploaded while suppressing list previews.