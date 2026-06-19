---
id: AW-013
title: Centralized client API layer
status: in-progress
source: FUTURE_WORK
area: client
priority: high
depends_on: []
updated: 2026-06-19
---

## Context
API calls are scattered and duplicate auth/error behavior across pages.

## Goal
Introduce shared API client modules with consistent error policy and typed wrappers.

## Acceptance Criteria
- [ ] Create base client module for URL, credentials, JSON parsing, and ApiError.
- [ ] Add domain wrappers (admin, galleries, viewer) with intent-named methods.
- [ ] Define centralized admin 401/403 policy.
- [ ] Incrementally migrate high-value pages.

## Notes
React Query and hono/client can be layered in after initial client module.