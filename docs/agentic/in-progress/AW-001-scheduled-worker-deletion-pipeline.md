---
id: AW-001
title: Scheduled worker deletion pipeline
status: in-progress
source: FUTURE_WORK
area: worker
priority: high
depends_on: []
updated: 2026-06-19
---

## Context
Soft deletes already exist for galleries and tenants, but hard purge is not automated.

## Goal
Add scheduled worker purge jobs with a grace period and auditable logging.

## Acceptance Criteria
- [ ] Purge galleries past grace period from D1 and R2.
- [ ] Purge tenant hierarchy after gallery purge completes.
- [ ] Log gallery id, tenant id, and object count for each purge run.

## Notes
Run in cron via wrangler scheduled handler.