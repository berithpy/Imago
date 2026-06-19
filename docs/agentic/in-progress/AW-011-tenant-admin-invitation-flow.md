---
id: AW-011
title: Tenant admin invitation flow
status: in-progress
source: FUTURE_WORK
area: auth
priority: high
depends_on: []
updated: 2026-06-19
---

## Context
New tenant admins should be onboarded by invitation email rather than manual credentials.

## Goal
Use invitation table and email flow for first tenant admin activation.

## Acceptance Criteria
- [ ] Tenant creation captures required admin email.
- [ ] Invitation is created or reused for that email and tenant.
- [ ] Email includes accept/set-password link.
- [ ] Activation is restricted to invited email identity.

## Notes
Align with better-auth invitation model.