import { Hono, type Context } from "hono";
import { Bindings } from "../index";
import { getDb } from "../lib/db";
import { resolveActorContext } from "../lib/roles";
import {
  checkTenantSlug,
  createSubTenant,
  createTenant,
  listTenants,
  restoreTenant,
  softDeleteTenant,
  updateTenant,
} from "../services/tenantService";
import { ServiceError } from "../services/types";

export const tenantsRoutes = new Hono<{ Bindings: Bindings }>();

type TenantContext = Context<{ Bindings: Bindings }>;

async function requireSuperAdmin(c: TenantContext) {
  const actor = await resolveActorContext(c);
  if (!actor.user) return c.json({ error: "Unauthorized" }, 401);
  if (!actor.superAdmin) return c.json({ error: "Forbidden" }, 403);
  return null;
}

// ------------------------------------------------------------------
// check-slug — public, no auth required
// ------------------------------------------------------------------
tenantsRoutes.get("/check-slug", async (c) => {
  const ctx = { env: c.env, db: getDb(c.env), actor: null };
  return c.json(await checkTenantSlug(ctx, c.req.query("slug") ?? ""));
});

// ------------------------------------------------------------------
// POST /sub-tenants — create a sub-tenant under an existing parent.
// Authorized for super-admin OR the tenant_operator of the parent.
// Mounted before the super-admin guard to allow non-super-admin owners.
// ------------------------------------------------------------------
tenantsRoutes.post("/sub-tenants", async (c) => {
  const actor = await resolveActorContext(c);
  if (!actor.user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req
    .json<{ parentId?: string; slug?: string; name?: string }>()
    .catch(() => ({} as { parentId?: string; slug?: string; name?: string }));

  try {
    const ctx = { env: c.env, db: getDb(c.env), actor };
    const tenant = await createSubTenant(ctx, {
      parentId: body.parentId,
      slug: body.slug,
      name: body.name,
      actor,
    });
    return c.json({ tenant }, 201);
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
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
  const ctx = { env: c.env, db: getDb(c.env), actor: null };
  return c.json({ tenants: await listTenants(ctx) });
});

// ------------------------------------------------------------------
// POST / — create tenant
// ------------------------------------------------------------------
tenantsRoutes.post("/", async (c) => {
  const body = await c.req
    .json<{ slug?: string; name?: string }>()
    .catch(() => ({} as { slug?: string; name?: string }));

  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    const tenant = await createTenant(ctx, {
      slug: body.slug ?? "",
      name: body.name ?? "",
    });
    return c.json({ tenant: { ...tenant, deleted_at: null } }, 201);
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// PATCH /:id — update name and/or slug
// ------------------------------------------------------------------
tenantsRoutes.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req
    .json<{ name?: string; slug?: string }>()
    .catch(() => ({} as { name?: string; slug?: string }));

  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    const tenant = await updateTenant(ctx, { id, name: body.name, slug: body.slug });
    return c.json({ tenant });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// DELETE /:id — soft-delete
// ------------------------------------------------------------------
tenantsRoutes.delete("/:id", async (c) => {
  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await softDeleteTenant(ctx, c.req.param("id"));
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// POST /:id/restore — clear soft-delete
// ------------------------------------------------------------------
tenantsRoutes.post("/:id/restore", async (c) => {
  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await restoreTenant(ctx, c.req.param("id"));
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});