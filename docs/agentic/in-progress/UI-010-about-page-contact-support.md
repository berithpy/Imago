---
id: UI-010
title: Add About page with support contact details
status: completed
source: ad-hoc
area: public-pages
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
There is no dedicated About page in the app for users to understand what Imago is and how to get help.

## Goal
Create an About page that explains Imago at a high level and provides a clear support contact path.

## Acceptance Criteria
- [x] A new About page route is available in the client app (for example, `/about`) and is reachable from existing navigation where appropriate.
- [x] The page includes concise product/about copy describing Imago's purpose.
- [x] The page includes a visible support contact entry for `imago-support@imago.berith.moe`.
- [x] The support entry is actionable as a `mailto:` link with the same address.
- [x] The page is responsive and readable on both mobile and desktop.
- [x] Basic metadata (page title and description) is set or updated so the About page is identifiable in browser/tab context.

## Notes
If final copy or contact details change, keep this ticket's acceptance criteria aligned with the agreed support address and content.

## Change Log
- 2026-06-27: Created.
- 2026-06-27: Completed implementation with route, navigation link, support mailto, and page metadata.