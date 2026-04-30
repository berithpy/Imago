import { Hono, type Context } from "hono";
import { Bindings } from "../index";
import { RESERVED_TENANT_SLUGS } from "../../shared/reservedSlugs";
import { resolveActorContext, canCreateSubTenant, ROLES } from "../lib/roles";
import { logAdminEvent } from "../lib/adminLog";

export const tenantsRoutes = new Hono<{ Bindings: Bindings }>();

const SLUG_RE = /^[a-z0-9-]+$/;

type TenantContext = Context<{ Bindings: Bindings }>;

// ------------------------------------------------------------------
// Shared platform-operator guard helper.
// Platform-operator status now comes from membership in the `imago` org
// (see resolveActorContext) — the legacy `is_super_admin` flag is gone.
// ------------------------------------------------------------------
async function requireSuperAdmin(c: TenantContext) {
  const actor = await resolveActorContext(c);
  if (!actor.user) return c.json({ error: "Unauthorized" }, 401);
  if (!actor.superAdmin) return c.json({ error: "Forbidden" }, 403);
  return null; // ok
}

// ------------------------------------------------------------------
// check-slug — public, no auth required
// ------------------------------------------------------------------
tenantsRoutes.get("/check-slug", async (c) => {
  const slug = c.req.query("slug") ?? "";
  const valid = SLUG_RE.test(slug);
  if (!valid) return c.json({ valid: false, available: false, reserved: false });
  if (RESERVED_TENANT_SLUGS.includes(slug)) {
    return c.json({ valid: true, available: false, reserved: true });
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM tenants WHERE slug = ?"
  )
    .bind(slug)
    .first();

  return c.json({ valid: true, available: !existing, reserved: false });
});

// ------------------------------------------------------------------
// POST /sub-tenants — create a sub-tenant under an existing parent.
// Authorized for super-admin OR the tenant_operator of the parent.
// Enforces depth ≤ 1 (parent must itself have no parent).
// Mounted before the super-admin guard to allow non-super-admin owners.
// ------------------------------------------------------------------
tenantsRoutes.post("/sub-tenants", async (c) => {
  const actor = await resolveActorContext(c);
  if (!actor.user) return c.json({ error: "Unauthorized" }, 401);

  const { parentId, slug, name } = await c.req
    .json<{ parentId?: string; slug?: string; name?: string }>()
    .catch(() => ({} as { parentId?: string; slug?: string; name?: string }));

  if (!parentId || !slug || !name) {
    return c.json({ error: "parentId, slug, and name are required" }, 400);
  }
  if (!SLUG_RE.test(slug)) {
    return c.json({ error: "Slug must only contain lowercase letters, numbers, and dashes" }, 400);
  }
  if (RESERVED_TENANT_SLUGS.includes(slug)) {
    return c.json({ error: "Slug is reserved" }, 400);
  }

  const parent = await c.env.DB
    .prepare("SELECT id, slug, parent_id FROM tenants WHERE id = ? AND deleted_at IS NULL")
    .bind(parentId)
    .first<{ id: string; slug: string; parent_id: string | null }>();
  if (!parent) return c.json({ error: "Parent tenant not found" }, 404);

  if (!canCreateSubTenant(actor, { id: parent.id, parentId: parent.parent_id })) {
    if (parent.parent_id) {
      return c.json({ error: "Sub-tenants cannot have sub-tenants" }, 400);
    }
    return c.json({ error: "Forbidden" }, 403);
  }

  const slugTaken = await c.env.DB
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind(slug)
    .first();
  if (slugTaken) return c.json({ error: "Slug already in use" }, 409);

  const tenantId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())"
    ).bind(orgId, name, slug),
    c.env.DB.prepare(
      "INSERT INTO tenants (id, slug, name, organization_id, parent_id, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())"
    ).bind(tenantId, slug, name, orgId, parent.id),
  ]);

  // If the creator is a non-super-admin tenant_operator of the parent,
  // automatically grant them sub_tenant_operator membership on the new
  // sub-tenant so they retain access without a separate invite step.
  if (!actor.superAdmin) {
    const memberId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO member (id, userId, organizationId, role, createdAt) VALUES (?, ?, ?, ?, unixepoch())"
    ).bind(memberId, actor.user.id, orgId, ROLES.SUB_TENANT_OPERATOR).run();
  }

  await logAdminEvent(c.env.DB, "SUB_TENANT_CREATED", {
    detail: slug,
    actor,
    tenantId,
    tenantParentId: parent.id,
  });

  return c.json(
    {
      tenant: {
        id: tenantId,
        slug,
        name,
        organization_id: orgId,
        parent_id: parent.id,
        deleted_at: null,
      },
    },
    201
  );
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
    "SELECT id, slug, name, organization_id, parent_id, deleted_at, created_at FROM tenants ORDER BY created_at DESC"
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

  if (RESERVED_TENANT_SLUGS.includes(slug)) {
    return c.json({ error: "Slug is reserved" }, 400);
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
