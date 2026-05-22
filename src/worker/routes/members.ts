import { Hono } from "hono";
import type { Bindings } from "../index";
import { getDb } from "../lib/db";
import { resolveActorContext } from "../lib/roles";
import {
  changeMemberRole,
  inviteMember,
  listMembers,
  removeMember,
} from "../services/memberService";
import { ServiceError } from "../services/types";
import type { TenantVariables } from "../middleware/tenant";

export const membersRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

// ------------------------------------------------------------------
// GET /  — list all members of the tenant
// requireTenantMember middleware on the parent mount enforces read auth.
// ------------------------------------------------------------------
membersRoutes.get("/", async (c) => {
  const ctx = { env: c.env, db: getDb(c.env), actor: null };
  return c.json({ members: await listMembers(ctx, c.get("tenantId")) });
});

// ------------------------------------------------------------------
// POST /invite
// ------------------------------------------------------------------
membersRoutes.post("/invite", async (c) => {
  const body = await c.req
    .json<{ email?: string; name?: string; role?: string }>()
    .catch(() => ({} as { email?: string; name?: string; role?: string }));

  try {
    const actor = await resolveActorContext(c);
    const ctx = { env: c.env, db: getDb(c.env), actor };
    const result = await inviteMember(ctx, {
      tenantId: c.get("tenantId"),
      actor,
      email: body.email,
      name: body.name,
      role: body.role,
      appOrigin: new URL(c.req.raw.url).origin,
      requestHeaders: c.req.raw.headers,
    });
    return c.json({ ok: true, member: result }, 201);
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// PATCH /:userId/role
// ------------------------------------------------------------------
membersRoutes.patch("/:userId/role", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json<{ role?: string }>().catch(() => ({} as { role?: string }));

  try {
    const actor = await resolveActorContext(c);
    const ctx = { env: c.env, db: getDb(c.env), actor };
    await changeMemberRole(ctx, {
      tenantId: c.get("tenantId"),
      userId,
      role: body.role,
      actor,
    });
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
// DELETE /:userId
// ------------------------------------------------------------------
membersRoutes.delete("/:userId", async (c) => {
  const userId = c.req.param("userId");
  try {
    const actor = await resolveActorContext(c);
    const ctx = { env: c.env, db: getDb(c.env), actor };
    await removeMember(ctx, {
      tenantId: c.get("tenantId"),
      userId,
      actor,
    });
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});