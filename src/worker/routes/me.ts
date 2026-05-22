import { Hono } from "hono";
import type { Bindings } from "../index";
import { resolveActorContext, roleDisplay } from "../lib/roles";

export const meRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/me — returns the current actor: user, super-admin flag, and the
 * full membership graph (with parent slugs and role display names) so the
 * SPA can build navigation without per-page session probes.
 *
 * 401 when no session.
 */
meRoutes.get("/", async (c) => {
  const actor = await resolveActorContext(c);
  if (!actor.user) return c.json({ error: "Unauthorized" }, 401);

  return c.json({
    user: actor.user,
    superAdmin: actor.superAdmin,
    memberships: actor.memberships.map((m) => ({
      tenantId: m.tenantId,
      tenantSlug: m.tenantSlug,
      tenantName: m.tenantName,
      role: m.role,
      roleDisplay: roleDisplay[m.role] ?? m.role,
      parentTenantSlug: m.parentTenantSlug,
    })),
  });
});
