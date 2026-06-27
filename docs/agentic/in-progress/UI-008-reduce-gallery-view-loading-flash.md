---
id: UI-008
title: Standardize auth-check no-flash loading behavior
status: done
source: ad-hoc
area: auth-routing
priority: medium
depends_on: []
updated: 2026-06-27
---

## Context
We have no-flash handling in some specific surfaces (for example, landing and operator), but login-check gating still appears to be implemented per-route. This leaves gaps where users can briefly see the wrong UI (app shell/skeleton) before redirect or final state resolves.

## Goal
Provide one reusable auth-check no-flash pattern that applies everywhere we verify login/session state, so first paint is state-correct (or neutral) without route-by-route reinvention.

## Acceptance Criteria
- [ ] A shared auth-gating primitive is introduced (hook/component/route utility) and used by routes that require login-state checks, rather than bespoke per-page logic.
- [ ] Shared primitive supports a neutral, layout-stable unresolved state that is valid for both outcomes (allowed vs redirected/blocked), avoiding optimistic app-shell flashes.
- [ ] Shared primitive supports redirect-back (`returnTo`) handling with same-origin relative-path validation.
- [ ] Existing no-flash implementations on landing/operator are migrated to, or aligned with, the shared primitive with no behavior regressions.
- [ ] Gallery and dashboard auth-check paths also use the shared primitive (including protected and unauthenticated paths).
- [ ] If a fast client hint is used, it remains non-authoritative, is schema-validated, reconciles immediately with server truth, and is cleared on invalidation events.
- [ ] Regression coverage includes at least landing, operator, gallery, and dashboard login-check flows under delayed auth probe conditions.

## Notes
Use no-ui-flash patterns for implementation design:
- Resolve as much route truth as possible before painting state-specific UI.
- Render outcome-agnostic placeholder only when truth cannot be known yet.
- Keep any hint payload minimal and schema-validated.
- Prefer explicit state transitions over abrupt skeleton-to-gate swaps.

Implementation direction:
- Add shared client utility at routing/auth boundary (for example, `AuthGate` + `useAuthGateState`) so route pages compose it consistently.
- Keep guard outcomes explicit: `allowed`, `redirect`, `blocked`, `unknown`.
- Avoid per-page loading skeleton assumptions in guarded routes.

Suggested validation approach:
- Add/extend route-level tests to verify redirect and access behavior for guarded and unguarded routes.
- Add client/UI tests that intentionally delay auth/session probe and assert unresolved UI remains neutral before final outcome.
- Manual pass on slow network throttling to confirm no visible flash of incorrect UI.

## Change Log
- 2026-06-25: Created
- 2026-06-25: Expanded scope from gallery-only to reusable app-wide auth-check no-flash pattern.