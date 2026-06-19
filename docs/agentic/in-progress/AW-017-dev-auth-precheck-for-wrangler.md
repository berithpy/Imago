---
id: AW-017
title: Dev auth precheck for Wrangler
status: in-progress
source: ad-hoc
area: devx
priority: medium
depends_on: []
updated: 2026-06-19
---

## Context
Local development currently starts Vite and Wrangler without first validating Cloudflare authentication. When auth is missing or expired, developers hit avoidable runtime friction and unclear failure paths.

## Goal
Fail fast before `npm run dev` startup when Cloudflare auth is unavailable, with a clear remediation path.

## Acceptance Criteria
- [ ] Update `package.json` so `npm run dev` keeps its current behavior but adds a `predev` hook that runs first.
- [ ] Add an auth-check script in `package.json` that runs `wrangler whoami --json` and exits non-zero with a clear remediation message when unauthenticated.
- [ ] Keep behavior non-interactive: instruct developers to run `wrangler login` (or set `CLOUDFLARE_API_TOKEN`) and rerun dev.
- [ ] Add a short troubleshooting note in `README.md` explaining the early auth failure and how to resolve it.

## Notes
Relevant files:
- `package.json` - add `predev` and auth-check scripts; preserve `dev`, `dev:spa`, and `dev:worker` flow.
- `README.md` - document precheck behavior and resolution path.

Verification:
- In an unauthenticated state, run `npm run dev` and confirm it exits before starting Vite/Wrangler with a clear auth message.
- Authenticate with `wrangler login`, rerun `npm run dev`, and confirm SPA and worker processes start as usual.
- Run `npm run dev:worker` directly to ensure existing worker command remains unchanged.

Decisions:
- Chosen behavior: message and exit when not authenticated.
- Auth signal source: `wrangler whoami --json` (documented and script-friendly).
- Out of scope: CI/deploy auth handling changes.

## Change Log
- 2026-06-19: Created
