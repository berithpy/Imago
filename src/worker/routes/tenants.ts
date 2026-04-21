import { Hono, type Context } from "hono";
import { Bindings } from "../index";
import { auth } from "../lib/auth";

export const tenantsRoutes = new Hono<{ Bindings: Bindings }>();

const SLUG_RE = /^[a-z0-9-]+$/;

type TenantContext = Context<{ Bindings: Bindings }>;

// ------------------------------------------------------------------
// Shared super-admin guard helper
// ------------------------------------------------------------------
async function requireSuperAdmin(c: TenantContext) {
  const origin = new URL(c.req.raw.url).origin;
  const session = await auth(c.env, origin).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const email = session.user.email;
  if (email == null) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare(
    "SELECT is_super_admin FROM user WHERE email = ?"
  )
    .bind(email)
    .first<{ is_super_admin: number }>();

  if (!user || !user.is_super_admin) return c.json({ error: "Forbidden" }, 403);
  return null; // ok
}

// ------------------------------------------------------------------
// check-slug — public, no auth required
// ------------------------------------------------------------------
tenantsRoutes.get("/check-slug", async (c) => {
  const slug = c.req.query("slug") ?? "";
  const valid = SLUG_RE.test(slug);
  if (!valid) return c.json({ valid: false, available: false });

  const existing = await c.env.DB.prepare(
    "SELECT id FROM tenants WHERE slug = ?"
  )
    .bind(slug)
    .first();

  return c.json({ valid: true, available: !existing });
});

// ------------------------------------------------------------------
// Auth guard for all remaining routes
// ------------------------------------------------------------------
tenantsRoutes.use("/*", async (c, next) => {
  const err = await requireSuperAdmin(c);
  if (err) return err;
  await next();
});

// ------------------------------------------------------------------
// GET / — list all tenants (including soft-deleted)
// ------------------------------------------------------------------
tenantsRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, slug, name, organization_id, deleted_at, created_at FROM tenants ORDER BY created_at DESC"
  ).all();
  return c.json({ tenants: results });
});

// ------------------------------------------------------------------
// POST / — create tenant
// ------------------------------------------------------------------
tenantsRoutes.post("/", async (c) => {
  const { slug, name } = await c.req.json<{ slug: string; name: string }>();

  if (!slug || !name) return c.json({ error: "slug and name are required" }, 400);

  if (!SLUG_RE.test(slug)) {
    return c.json({ error: "Slug must only contain lowercase letters, numbers, and dashes" }, 400);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM tenants WHERE slug = ?"
  )
    .bind(slug)
    .first();
  if (existing) return c.json({ error: "Slug already in use" }, 409);

  const tenantId = crypto.randomUUID();
  const orgId = crypto.randomUUID();

  // Create the organization and tenant rows atomically to avoid orphaning
  // the organization record if the tenant insert fails.
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())"
    ).bind(orgId, name, slug),
    c.env.DB.prepare(
      "INSERT INTO tenants (id, slug, name, organization_id, created_at) VALUES (?, ?, ?, ?, unixepoch())"
    ).bind(tenantId, slug, name, orgId),
  ]);

  return c.json(
    { tenant: { id: tenantId, slug, name, organization_id: orgId, deleted_at: null } },
    201
  );
});

// ------------------------------------------------------------------
// PATCH /:id — update name and/or slug
// ------------------------------------------------------------------
tenantsRoutes.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const { name, slug } = await c.req.json<{ name?: string; slug?: string }>();

  const tenant = await c.env.DB.prepare(
    "SELECT id, slug, name, organization_id FROM tenants WHERE id = ? AND deleted_at IS NULL"
  )
    .bind(id)
    .first<{ id: string; slug: string; name: string; organization_id: string | null }>();

  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  if (slug !== undefined && !SLUG_RE.test(slug)) {
    return c.json({ error: "Slug must only contain lowercase letters, numbers, and dashes" }, 400);
  }

  if (slug && slug !== tenant.slug) {
    const conflict = await c.env.DB.prepare(
      "SELECT id FROM tenants WHERE slug = ? AND id != ?"
    )
      .bind(slug, id)
      .first();
    if (conflict) return c.json({ error: "Slug already in use" }, 409);
  }

  const newName = name ?? tenant.name;
  const newSlug = slug ?? tenant.slug;

  await c.env.DB.prepare(
    "UPDATE tenants SET name = ?, slug = ? WHERE id = ?"
  )
    .bind(newName, newSlug, id)
    .run();

  // Sync the linked organization if one exists
  if (tenant.organization_id) {
    await c.env.DB.prepare(
      "UPDATE organization SET name = ?, slug = ? WHERE id = ?"
    )
      .bind(newName, newSlug, tenant.organization_id)
      .run();
  }

  return c.json({ tenant: { id, slug: newSlug, name: newName } });
});

// ------------------------------------------------------------------
// DELETE /:id — soft-delete
// ------------------------------------------------------------------
tenantsRoutes.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const tenant = await c.env.DB.prepare(
    "SELECT id FROM tenants WHERE id = ? AND deleted_at IS NULL"
  )
    .bind(id)
    .first();
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  await c.env.DB.prepare(
    "UPDATE tenants SET deleted_at = unixepoch() WHERE id = ?"
  )
    .bind(id)
    .run();

  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// POST /:id/restore — clear soft-delete
// ------------------------------------------------------------------
tenantsRoutes.post("/:id/restore", async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare(
    "UPDATE tenants SET deleted_at = NULL WHERE id = ?"
  )
    .bind(id)
    .run();

  if (!result.meta || result.meta.changes === 0) {
    return c.json({ error: "Tenant not found" }, 404);
  }

  return c.json({ ok: true });
});
