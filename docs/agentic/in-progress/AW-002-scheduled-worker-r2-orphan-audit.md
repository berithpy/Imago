---
id: AW-002
title: Scheduled R2 orphan audit
status: in-progress
source: FUTURE_WORK
area: worker
priority: medium
depends_on: [AW-001]
updated: 2026-06-19
---

## Context
R2 objects can exist without matching photo rows after partial failures or past bugs.

## Goal
Run periodic orphan detection and cleanup between R2 keys and photos table.

## Acceptance Criteria
- [ ] Scheduled audit lists R2 objects and verifies D1 row existence.
- [ ] Missing-row objects are flagged or deleted based on policy.
- [ ] Job frequency is lower than deletion pipeline (weekly default).

## Notes
Read-heavy task; should be quota-aware.