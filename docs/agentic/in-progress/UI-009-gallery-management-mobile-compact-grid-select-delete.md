---
id: UI-009
title: Gallery management responsive view modes with shared small grid
status: in-progress
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
- [ ] Mobile viewports support exactly two available modes: `list` and `small grid`.
- [ ] Desktop viewports support exactly two available modes: `grid` and `small grid`.
- [ ] `Small grid` is a shared mode available on both mobile and desktop with consistent behavior and selection semantics.
- [ ] Multi-select remains easy on touch devices (clear selected state, large enough tap targets, reliable toggle behavior).
- [ ] Bulk delete is accessible directly from `small grid` on both mobile and desktop.
- [ ] Selection count and destructive action affordances remain visible and understandable during scroll.
- [ ] Existing defaults remain: mobile defaults to `list`, desktop defaults to `grid`, with no regressions.

## Notes
Implementation likely touches gallery management layout components, selection toolbar behavior, responsive mode gating, and view-mode toggles per viewport class.

## Change Log
- 2026-06-27: Created
- 2026-06-27: Expanded scope so compact grid mode is also accessible on desktop.
- 2026-06-27: Clarified responsive mode matrix: mobile=list+small grid, desktop=grid+small grid.
