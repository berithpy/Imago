---
id: AW-004
title: Email subscription confirmations
status: in-progress
source: FUTURE_WORK
area: notifications
priority: medium
depends_on: []
updated: 2026-06-19
---

## Context
Subscribe and unsubscribe token flows exist, but confirmation emails are not sent.

## Goal
Send confirmation emails for subscription opt-in and opt-out events.

## Acceptance Criteria
- [ ] Send verify-link email on subscribe request.
- [ ] Send acknowledgement email on unsubscribe confirmation.
- [ ] Email sender/domain onboarding is validated.

## Notes
Transactional and low-volume; inline send is acceptable.