---
id: UI-002
title: Gallery list square thumbnail
status: in-progress
source: MINOR_UI_ISSUES
area: gallery-list
priority: medium
depends_on: []
updated: 2026-06-19
---

## Context
Gallery list relies on names without visual thumbnail cues.

## Goal
Show square gallery thumbnails with backend thumbnail resolution.

## Acceptance Criteria
- [ ] Worker endpoint resolves gallery thumbnail photo.
- [ ] Resolution prefers starred thumbnail, fallback to first photo.
- [ ] Gallery list renders square thumbnail per item.

## Notes
Reuse existing OpenGraph thumbnail logic where possible.