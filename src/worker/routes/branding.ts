import { Hono } from "hono";
import type { Bindings } from "../index";
import { getDb } from "../lib/db";
import { resolveActorContext } from "../lib/roles";
import { clearBranding, getBranding, updateBranding } from "../services/tenantService";
import { ServiceError } from "../services/types";
import type { TenantVariables } from "../middleware/tenant";

export const brandingRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

// ------------------------------------------------------------------
// GET /  — return parsed branding overrides (or {})
// Read access is gated by requireTenantMember on the parent mount.
// ------------------------------------------------------------------
brandingRoutes.get("/", async (c) => {
  const ctx = { env: c.env, db: getDb(c.env), actor: null };
  const result = await getBranding(ctx, c.get("tenantId"));
  return c.json(result);
});

// ------------------------------------------------------------------
// PATCH /  — replace branding overrides JSON
// Write access requires canManageMembers (operator-level).
// ------------------------------------------------------------------
brandingRoutes.patch("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const actor = await resolveActorContext(c);
    const ctx = { env: c.env, db: getDb(c.env), actor };
    const result = await updateBranding(ctx, {
      tenantId: c.get("tenantId"),
      body,
      actor,
    });
    return c.json({ ok: true, branding: result.branding });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// DELETE /  — clear branding overrides (revert to inherit/defaults)
// ------------------------------------------------------------------
brandingRoutes.delete("/", async (c) => {
  try {
    const actor = await resolveActorContext(c);
    const ctx = { env: c.env, db: getDb(c.env), actor };
    await clearBranding(ctx, { tenantId: c.get("tenantId"), actor });
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});