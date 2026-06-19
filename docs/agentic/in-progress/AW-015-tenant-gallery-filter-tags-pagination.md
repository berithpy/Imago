---
id: AW-015
title: Tenant gallery filter, tags, and pagination
status: in-progress
source: FUTURE_WORK
area: tenant-dashboard
priority: medium
depends_on: []
updated: 2026-06-19
---

## Context
Tenant gallery lists need server-side filtering and better organization.

## Goal
Add worker-backed filter, pagination, and tag-based categorization.

## Acceptance Criteria
- [ ] Filter by name and date at API level.
- [ ] Add pagination in tenant gallery list API and UI.
- [ ] Model gallery tags with many-to-many relationship.
- [ ] Support tag-based filtering without fetching full dataset.

## Notes
Prefer indexed queries and explicit sort order for stability.