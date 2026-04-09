---
description: "Use when fixing bugs, adding features, or debugging issues in the Hono worker, API routes, middleware, or worker lib. Enforces test-first workflow."
applyTo: "src/worker/**"
---

## Workflow: Test First

When fixing a bug or adding behaviour to the worker:

1. **Write a failing test first** — add it to the relevant file in `src/worker/routes/__tests__/` using the existing harness. Run `npm run test:routes` to confirm it fails for the right reason.
2. **Fix the implementation** — make the minimal change needed to pass the test.
3. **Re-run tests** — confirm the new test passes and no existing tests regressed.

If writing a test is genuinely impractical for the specific change (e.g. a config tweak with no observable route behaviour), note why before skipping this step.
