---
id: AW-006
title: Tenant plan limits enforcement
status: in-progress
source: FUTURE_WORK
area: tenancy
priority: high
depends_on: []
updated: 2026-06-19
---

## Context
Tenants need resource limits to control abuse and cost.

## Goal
Define plan defaults and enforce limits at API boundaries.

## Acceptance Criteria
- [ ] Add tenant plan model and optional per-tenant limit overrides.
- [ ] Add photo size_bytes for storage accounting.
- [ ] Enforce limits before insert/update with clear API errors.
- [ ] Return usage and limit details in error responses.

## Notes
Application-level checks preferred over opaque DB constraint errors.