import { Hono, type Context } from "hono";
import type { Bindings } from "../index";
import { logAdminEvent } from "../lib/adminLog";
import { resolveActorContext, canManageMembers } from "../lib/roles";
import type { TenantVariables } from "../middleware/tenant";

type BrandingCtx = Context<{ Bindings: Bindings; Variables: TenantVariables }>;

export const brandingRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

async function loadTenant(
  c: BrandingCtx
): Promise<{ id: string; parentId: string | null; brandingOverrides: string | null } | null> {
  const tenantId = c.get("tenantId") as string | undefined;
  if (!tenantId) return null;
  const row = await c.env.DB.prepare(
    "SELECT id, parent_id AS parentId, branding_overrides AS brandingOverrides FROM tenants WHERE id = ?"
  )
    .bind(tenantId)
    .first<{ id: string; parentId: string | null; brandingOverrides: string | null }>();
  return row ?? null;
}

// ------------------------------------------------------------------
// GET /  — return parsed branding overrides (or {})
// Read access is gated by requireTenantMember on the parent mount.
// ------------------------------------------------------------------
brandingRoutes.get("/", async (c) => {
  const tenant = await loadTenant(c);
  if (!tenant) return c.json({ branding: {} });
  const parsed = tenant.brandingOverrides ? safeParse(tenant.brandingOverrides) : {};
  return c.json({ branding: parsed });
});

// ------------------------------------------------------------------
// PATCH /  — replace branding overrides JSON
// Write access requires canManageMembers (operator-level).
// ------------------------------------------------------------------
brandingRoutes.patch("/", async (c) => {
  const tenant = await loadTenant(c);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  const actor = await resolveActorContext(c);
  if (!canManageMembers(actor, tenant.id, tenant.parentId)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Body must be a JSON object" }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE tenants SET branding_overrides = ? WHERE id = ?"
  )
    .bind(JSON.stringify(body), tenant.id)
    .run();

  await logAdminEvent(c.env.DB, "BRANDING_UPDATED", {
    actor,
    tenantId: tenant.id,
  });

  return c.json({ ok: true, branding: body });
});

// ------------------------------------------------------------------
// DELETE /  — clear branding overrides (revert to inherit/defaults)
// ------------------------------------------------------------------
brandingRoutes.delete("/", async (c) => {
  const tenant = await loadTenant(c);
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  const actor = await resolveActorContext(c);
  if (!canManageMembers(actor, tenant.id, tenant.parentId)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await c.env.DB.prepare(
    "UPDATE tenants SET branding_overrides = NULL WHERE id = ?"
  )
    .bind(tenant.id)
    .run();

  await logAdminEvent(c.env.DB, "BRANDING_CLEARED", {
    actor,
    tenantId: tenant.id,
  });

  return c.json({ ok: true });
});

function safeParse(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
