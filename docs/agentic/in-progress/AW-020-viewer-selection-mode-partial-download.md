---
id: AW-020
title: Viewer selection mode for partial photo download
status: in-progress
source: ad-hoc
area: viewer-downloads
priority: medium
depends_on: [AW-019]
updated: 2026-06-27
---

## Context
Viewers often want only a subset of photos instead of downloading an entire gallery export. A dedicated viewer flow is needed to enter selection mode, mark desired photos, and download only that subset.

## Goal
Add a viewer-facing selection mode that allows selecting a limited set of photos and downloading only the selected subset.

## Acceptance Criteria
- [ ] Viewer UI includes an explicit "selection mode" entry point that is discoverable on mobile and desktop.
- [ ] In selection mode, viewers can select/deselect photos and see current selected count.
- [ ] Viewer can download a subset package containing only selected photos.
- [ ] Selection/download flow enforces configured limits for maximum items per package and provides clear feedback when limits are exceeded.
- [ ] Viewer auth/token checks are enforced for subset download requests.
- [ ] Empty-selection and partial-failure cases are handled with clear user feedback.

## Notes
This ticket builds on API contract decisions made in `AW-019`. AW-019 should keep endpoint shape and authorization design compatible with future viewer-token usage so this work can be implemented without breaking changes.

Potential design details to refine during implementation:
- Where selection state lives in viewer experience (client-only vs server-assisted).
- Limit policy source (tenant/gallery/app config) and error wording.
- Download packaging approach reuse from admin flow vs separate pipeline.

## Change Log
- 2026-06-27: Created
