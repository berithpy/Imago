---
id: AW-014
title: Tenant onboarding flow
status: in-progress
source: FUTURE_WORK
area: tenancy
priority: high
depends_on: [AW-011]
updated: 2026-06-19
---

## Context
Tenant creation should include a visible onboarding lifecycle, not just row creation.

## Goal
Ship reliable manual onboarding now and leave runway for controlled self-serve later.

## Acceptance Criteria
- [ ] Manual path: invite, email, accept, first login.
- [ ] Track onboarding states (invited, accepted, active, expired).
- [ ] Add resend/retry controls and audit trail.
- [ ] Keep self-serve disabled behind explicit policy gates.

## Notes
Design shared pipeline so manual and future self-serve reuse same activation flow.