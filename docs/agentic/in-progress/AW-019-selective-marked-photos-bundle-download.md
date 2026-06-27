---
id: AW-019
title: Selective marked-photo bundle download package
status: in-progress
source: ad-hoc
area: exports-and-downloads
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
Current export/download behavior focuses on full-gallery export flows, which is heavier than needed when admins only want a subset of marked photos. Viewer partial-download demand exists too, but that flow should be tracked and delivered separately.

## Goal
Deliver admin selective bundle download now, while shaping API contracts so a viewer-scoped selective download flow can be added later without rework.

## Acceptance Criteria
- [ ] Admin users can create a download package from only marked/selected photos.
- [ ] Bundle generation excludes unmarked photos and reduces payload size compared to full export.
- [ ] Download flow clearly indicates it is a subset package (count/selection scope).
- [ ] Existing full-export workflow remains available and unchanged by default.
- [ ] Error handling covers empty selections, missing files, and partial failures.
- [ ] API contract and authorization boundaries are defined with future viewer-token support in mind, but viewer UX/flow is explicitly out of scope for this ticket.

## Notes
Likely requires coordination across admin selection state, API endpoint(s), bundle creation logic, and download UI messaging.

Viewer-facing selection mode and partial download flow are intentionally deferred to `AW-020`.

## Change Log
- 2026-06-27: Created
- 2026-06-27: Scoped delivery to admin flow and added viewer-API-forward requirements; deferred viewer UX to AW-020.
