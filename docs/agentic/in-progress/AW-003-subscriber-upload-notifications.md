---
id: AW-003
title: Subscriber upload notifications
status: in-progress
source: FUTURE_WORK
area: notifications
priority: high
depends_on: [AW-001]
updated: 2026-06-19
---

## Context
Subscribers should be notified of new uploads without slowing upload requests.

## Goal
Implement daily digest notification per gallery with anti-spam limits.

## Acceptance Criteria
- [ ] At most one notification email per gallery per day.
- [ ] Upload route marks pending notification but does not send inline.
- [ ] Daily cron sends only for galleries with verified subscribers and new uploads.
- [ ] Sent timestamp is persisted to prevent duplicate sends.

## Notes
Use Cloudflare Email service binding for delivery.