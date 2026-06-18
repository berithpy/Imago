import { Context, Next } from "hono";
import { Bindings } from "../index";
import { getDb } from "../lib/db";
import { tenants } from "../lib/schema";
import { and, eq, isNull } from "drizzle-orm";

export type TenantVariables = {
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
};

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

  const tenant = await getDb(c.env)
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name })
    .from(tenants)
    .where(and(eq(tenants.slug, slug), isNull(tenants.deletedAt)))
    .get();

  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  c.set("tenantId", tenant.id);
  c.set("tenantSlug", tenant.slug);
  c.set("tenantName", tenant.name);
  await next();
}
