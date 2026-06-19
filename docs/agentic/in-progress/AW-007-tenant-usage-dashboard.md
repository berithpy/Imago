---
id: AW-007
title: Tenant usage dashboard
status: in-progress
source: FUTURE_WORK
area: tenancy
priority: medium
depends_on: [AW-006]
updated: 2026-06-19
---

## Context
Admins need visibility into plan usage and headroom.

## Goal
Expose usage metrics and display them in tenant and operator dashboards.

## Acceptance Criteria
- [ ] Add usage endpoint with gallery counts and storage totals.
- [ ] Tenant dashboard displays current usage vs limits.
- [ ] Operator tenant list shows per-tenant usage summary.

## Notes
Use COUNT and SUM from D1 as source of truth.