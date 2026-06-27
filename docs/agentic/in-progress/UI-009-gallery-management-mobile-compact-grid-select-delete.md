---
id: UI-009
title: Gallery management responsive view modes with shared small grid
status: completed
source: ad-hoc
area: gallery-management
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
Gallery management currently offers list-only on mobile and grid-only on desktop. We want parity around a shared small-grid workflow so selection and delete actions can be done quickly on both device classes.

## Goal
Implement responsive view-mode behavior where mobile supports list + small grid, desktop supports grid + small grid, and the shared small grid is optimized for fast multi-select/delete workflows.

## Acceptance Criteria
- [x] Mobile viewports support exactly two available modes: `list` and `small grid`.
- [x] Desktop viewports support exactly two available modes: `grid` and `small grid`.
- [x] `Small grid` is a shared mode available on both mobile and desktop with consistent behavior and selection semantics.
- [x] Multi-select remains easy on touch devices (clear selected state, large enough tap targets, reliable toggle behavior).
- [x] Bulk delete is accessible directly from `small grid` on both mobile and desktop.
- [x] Selection count and destructive action affordances remain visible and understandable during scroll.
- [x] Existing defaults remain: mobile defaults to `list`, desktop defaults to `grid`, with no regressions.

## Notes
Implementation likely touches gallery management layout components, selection toolbar behavior, responsive mode gating, and view-mode toggles per viewport class.

## Change Log
- 2026-06-27: Created
- 2026-06-27: Expanded scope so compact grid mode is also accessible on desktop.
- 2026-06-27: Clarified responsive mode matrix: mobile=list+small grid, desktop=grid+small grid.
- 2026-06-27: Completed implementation with responsive view-mode gating and sticky selection actions.
