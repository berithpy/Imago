---
id: UI-013
title: Sync gallery scroll position while navigating lightbox with arrow keys
status: in-progress
source: ad-hoc
area: gallery-view
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
The gallery already has logic to focus and scroll to a specific photo in some navigation flows. In lightbox mode, users can move between photos with arrow navigation, but the underlying page scroll position does not stay aligned with the photo currently shown in the lightbox.

## Goal
Keep the gallery page scrolled to the photo currently displayed in the lightbox while navigating with lightbox arrow controls.

## Acceptance Criteria
- [ ] When the lightbox moves to the next photo via arrow navigation, the page scroll updates to keep that photo in view in the gallery.
- [ ] When the lightbox moves to the previous photo via arrow navigation, the page scroll updates to keep that photo in view in the gallery.
- [ ] Existing "open lightbox on specific photo and scroll to it" behavior continues to work unchanged.
- [ ] No regressions are introduced for non-lightbox gallery navigation or selection interactions.

## Notes
Apply the same photo-targeting scroll behavior currently used for direct photo targeting/open actions to lightbox next/previous transitions.

## Change Log
- 2026-06-27: Created.
