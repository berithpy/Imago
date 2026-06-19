---
id: AW-008
title: Storage reconciliation cron
status: in-progress
source: FUTURE_WORK
area: worker
priority: medium
depends_on: [AW-006]
updated: 2026-06-19
---

## Context
Storage counters can drift when deletes do not decrement totals correctly.

## Goal
Add periodic reconciliation that recalculates tenant storage from photos table.

## Acceptance Criteria
- [ ] Weekly job recomputes storage totals from D1 rows.
- [ ] Drift is corrected safely and logged.
- [ ] Reconciliation can run with orphan audit schedule.

## Notes
Keep idempotent and inexpensive.