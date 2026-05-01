# Worker services

The application layer. One module per aggregate (gallery, tenant, member,
photo, viewerAuth, adminAuth, subscriber). Services own invariants,
audit-log emission, and orchestration across D1, R2, Cloudflare Images,
and email. Routes are transport only and call services; the planned
scheduled worker will call the same services without HTTP.

## Conventions

- **Shape**: plain async functions, not classes or factories.
  Signature: `doThing(ctx: ServiceCtx, input, ...): Promise<Result>`.
- **No Hono**: services must not import from `hono` or accept a `Context`.
  Routes build `ServiceCtx` from `c` and pass it down.
- **Errors**: throw `ServiceError(code, message)`. Routes map `error.status`
  to the HTTP response; non-HTTP callers branch on `error.code`.
- **Audit**: services that mutate state call `logAdminEvent` themselves.
  Routes do **not** call `logAdminEvent` after their phase ports.
- **DB**: use the Drizzle client on `ctx.db`. Raw `sql\`...\`` is allowed
  as an escape hatch but `c.env.DB.prepare(...)` is forbidden in services.
- **External bindings**: services call R2 (`ctx.env.IMAGES_BUCKET`),
  Cloudflare Images (`ctx.env.IMAGES`), and email (`sendEmail`) directly.
  No abstract repository interfaces.

## Direction

`routes → services → lib`. Services may import from `lib/`. `lib/` must
not import from `services/`. Routes must not import from `lib/db.ts`'s
raw helpers once their phase has landed.

## Testing

Service tests live in `src/worker/services/__tests__/` and reuse the
harness from `src/worker/routes/__tests__/testHarness.ts` — real D1,
stubbed R2/Images, mocked Resend. Route tests stay as the parity gate
during each port.
