---
id: AW-005
title: Gallery expiry warning email
status: in-progress
source: FUTURE_WORK
area: notifications
priority: medium
depends_on: [AW-004]
updated: 2026-06-19
---

## Context
When a gallery is soft-deleted, subscribers need advance warning before permanent purge.

## Goal
Email verified subscribers with deletion date and export link.

## Acceptance Criteria
- [ ] Warning is sent when gallery enters soft-deleted state.
- [ ] Message includes deletion date and export/download URL.
- [ ] Send policy is defined (inline vs deferred) and implemented.

## Notes
One-time event per gallery deletion.