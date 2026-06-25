---
id: AW-018
title: Dashboard route guard without tenant or operator context
status: in-progress
source: ad-hoc
area: auth-routing
priority: medium
depends_on: []
updated: 2026-06-24
---

## Context
Navigating directly to the dashboard route can render a page for users who do not have a tenant context and are not an operator. The page loads but does not provide a usable experience.

## Goal
Ensure dashboard entry is inaccessible for users without required tenant/operator context, and decide whether to remove the route entirely or redirect to a valid destination.

## Acceptance Criteria
- [ ] Reproduce and document current behavior for direct dashboard navigation without tenant and without operator.
- [ ] Identify where route gating should happen (client routing guard, worker authorization response, or both) and capture the chosen approach.
- [ ] Implement behavior so unsupported users no longer land on a non-functional dashboard page.
- [ ] If route removal is chosen, remove or hide all links and navigation paths that expose it.
- [ ] Add or update tests covering unauthorized dashboard access behavior.

## Notes
Potential outcomes:
- Redirect unsupported users to login, tenant picker, or a safe default route.
- Return an explicit unauthorized/forbidden state instead of rendering a broken dashboard shell.

Relevant areas:
- `src/client` routing and auth context guards.
- `src/worker/routes` authorization and tenant/operator identity checks for dashboard data.

Decision required:
- Keep route with strict guard/redirect behavior, or remove route exposure entirely for unsupported roles.

## Change Log
- 2026-06-24: Created