---
id: AW-012
title: Workers KV subscriber scaling option
status: in-progress
source: FUTURE_WORK
area: scalability
priority: low
depends_on: []
updated: 2026-06-19
---

## Context
At larger scale, subscriber writes may outgrow D1 contention profile.

## Goal
Evaluate optional migration of subscriber storage to Workers KV.

## Acceptance Criteria
- [ ] Define trigger thresholds for evaluating migration.
- [ ] Document consistency and transactional tradeoffs.
- [ ] Produce migration and rollback strategy.

## Notes
Optimization only; not a near-term requirement.