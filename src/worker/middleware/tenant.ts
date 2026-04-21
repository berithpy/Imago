import { Context, Next } from "hono";
import { Bindings } from "../index";

export type TenantVariables = { tenantId?: string };

/**
 * Middleware: resolve tenant from `:tenantSlug` path parameter and inject
 * `tenantId` into Hono context variables. Must be mounted on a route group
 * that has `:tenantSlug` in its path (e.g. `/api/t/:tenantSlug`).
 */
export async function requireTenant(
  c: Context<{ Bindings: Bindings; Variables: TenantVariables }>,
  next: Next
) {
  const slug = c.req.param("tenantSlug");
  if (!slug) return c.json({ error: "Tenant required" }, 400);

  const tenant = await c.env.DB
    .prepare("SELECT id FROM tenants WHERE slug = ? AND deleted_at IS NULL")
    .bind(slug)
    .first<{ id: string }>();

  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  c.set("tenantId", tenant.id);
  await next();
}
