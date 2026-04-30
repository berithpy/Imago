import { Hono, type Context } from "hono";
import type { Bindings } from "../index";
import { auth } from "../lib/auth";
import { sendEmail, invitedUserHtml } from "../lib/email";
import { logAdminEvent } from "../lib/adminLog";
import {
  resolveActorContext,
  canManageMembers,
  isTenantRole,
  ROLES,
  TENANT_ROLE_VALUES,
  type TenantRole,
} from "../lib/roles";
import type { TenantVariables } from "../middleware/tenant";

type MemberCtx = Context<{ Bindings: Bindings; Variables: TenantVariables }>;

export const membersRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Resolve the org id linked to the tenant in context, or 404. */
async function getTenantOrgId(c: MemberCtx): Promise<string | null> {
  const tenantId = c.get("tenantId") as string | undefined;
  if (!tenantId) return null;
  const row = await c.env.DB.prepare(
    "SELECT organization_id AS organizationId FROM tenants WHERE id = ?"
  )
    .bind(tenantId)
    .first<{ organizationId: string | null }>();
  return row?.organizationId ?? null;
}

/** Count of members with role tenant_operator in `orgId`. */
async function operatorCount(c: MemberCtx, orgId: string): Promise<number> {
  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM member WHERE organizationId = ? AND role = ?"
  )
    .bind(orgId, ROLES.TENANT_OPERATOR)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// ------------------------------------------------------------------
// GET /  — list all members of the tenant
// Any direct member of the tenant (or Imago operator) can read.
// requireTenantMember middleware on the parent mount already enforces this,
// so we only need to surface the rows.
// ------------------------------------------------------------------
membersRoutes.get("/", async (c) => {
  const orgId = await getTenantOrgId(c);
  if (!orgId) return c.json({ members: [] });

  const { results } = await c.env.DB.prepare(
    `SELECT u.id    AS userId,
            u.email AS email,
            u.name  AS name,
            m.role  AS role,
            m.createdAt AS joinedAt
     FROM member m
     INNER JOIN user u ON u.id = m.userId
     WHERE m.organizationId = ?
     ORDER BY m.createdAt ASC`
  )
    .bind(orgId)
    .all<{ userId: string; email: string; name: string; role: string; joinedAt: number }>();

  return c.json({ members: results });
});

// ------------------------------------------------------------------
// POST /invite  — create user (if needed), attach to tenant org with role,
// and send a magic link for activation. Caller must hold canManageMembers.
// ------------------------------------------------------------------
membersRoutes.post("/invite", async (c) => {
  const tenantId = c.get("tenantId") as string | undefined;
  if (!tenantId) return c.json({ error: "Tenant required" }, 400);

  const actor = await resolveActorContext(c);
  // Look up parent for canManageMembers (sub-tenant case).
  const tenantRow = await c.env.DB.prepare(
    "SELECT parent_id AS parentId FROM tenants WHERE id = ?"
  )
    .bind(tenantId)
    .first<{ parentId: string | null }>();
  if (!canManageMembers(actor, tenantId, tenantRow?.parentId ?? null)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ email?: string; name?: string; role?: string }>();
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const role = body.role;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }
  if (!name) return c.json({ error: "Name required" }, 400);
  if (!role || !isTenantRole(role)) {
    return c.json(
      { error: `Invalid role. Expected one of ${TENANT_ROLE_VALUES.join(", ")}.` },
      400
    );
  }

  const orgId = await getTenantOrgId(c);
  if (!orgId) return c.json({ error: "Tenant has no organization" }, 400);

  // Create the user via better-auth if missing. Existing user is fine —
  // we just attach them to this tenant org.
  const origin = new URL(c.req.raw.url).origin;
  const existing = await c.env.DB.prepare(
    "SELECT id FROM user WHERE lower(email) = ?"
  )
    .bind(email)
    .first<{ id: string }>();

  if (!existing) {
    try {
      await auth(c.env, origin).api.signUpEmail({
        body: { email, name, password: crypto.randomUUID() },
      });
    } catch (err: any) {
      if (!(err?.message?.includes("already") || err?.status === 422)) {
        return c.json({ error: "Failed to create user" }, 500);
      }
    }
  }

  const userRow = await c.env.DB.prepare(
    "SELECT id FROM user WHERE lower(email) = ?"
  )
    .bind(email)
    .first<{ id: string }>();
  if (!userRow) return c.json({ error: "Failed to create user" }, 500);

  // Refuse duplicate membership in the same org.
  const dup = await c.env.DB.prepare(
    "SELECT 1 FROM member WHERE userId = ? AND organizationId = ?"
  )
    .bind(userRow.id, orgId)
    .first();
  if (dup) return c.json({ error: "User is already a member" }, 409);

  await c.env.DB.prepare(
    "INSERT INTO member (id, userId, organizationId, role, createdAt) VALUES (?, ?, ?, ?, unixepoch())"
  )
    .bind(crypto.randomUUID(), userRow.id, orgId, role as TenantRole)
    .run();

  // Send a magic link for activation. Failure logs but does not block.
  try {
    await auth(c.env, origin).api.signInMagicLink({
      body: { email, callbackURL: "/login/resolve" },
      headers: c.req.raw.headers,
    });
  } catch (err) {
    console.error("[members/invite] magic link failed:", err);
  }

  // Best-effort notification email — keeps the existing invitedUserHtml
  // template in use for consistency with gallery invites.
  try {
    await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, {
      to: email,
      subject: "You've been invited to Imago",
      html: invitedUserHtml("the team", origin, email),
    });
  } catch (err) {
    console.error("[members/invite] email failed:", err);
  }

  await logAdminEvent(c.env.DB, "MEMBER_INVITED", {
    detail: email,
    actor,
    tenantId,
  });

  return c.json({ ok: true, member: { userId: userRow.id, email, role } }, 201);
});

// ------------------------------------------------------------------
// PATCH /:userId/role  — change the role of an existing member
// ------------------------------------------------------------------
membersRoutes.patch("/:userId/role", async (c) => {
  const tenantId = c.get("tenantId") as string | undefined;
  if (!tenantId) return c.json({ error: "Tenant required" }, 400);

  const actor = await resolveActorContext(c);
  const tenantRow = await c.env.DB.prepare(
    "SELECT parent_id AS parentId FROM tenants WHERE id = ?"
  )
    .bind(tenantId)
    .first<{ parentId: string | null }>();
  if (!canManageMembers(actor, tenantId, tenantRow?.parentId ?? null)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const userId = c.req.param("userId");
  const { role } = await c.req.json<{ role?: string }>();
  if (!role || !isTenantRole(role)) {
    return c.json(
      { error: `Invalid role. Expected one of ${TENANT_ROLE_VALUES.join(", ")}.` },
      400
    );
  }

  const orgId = await getTenantOrgId(c);
  if (!orgId) return c.json({ error: "Tenant has no organization" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT role FROM member WHERE userId = ? AND organizationId = ?"
  )
    .bind(userId, orgId)
    .first<{ role: string }>();
  if (!existing) return c.json({ error: "Member not found" }, 404);

  // Block demoting the last tenant_operator — leaves the tenant orphaned.
  if (existing.role === ROLES.TENANT_OPERATOR && role !== ROLES.TENANT_OPERATOR) {
    const count = await operatorCount(c, orgId);
    if (count <= 1) {
      return c.json({ error: "Cannot demote the last tenant operator" }, 409);
    }
  }

  await c.env.DB.prepare(
    "UPDATE member SET role = ? WHERE userId = ? AND organizationId = ?"
  )
    .bind(role as TenantRole, userId, orgId)
    .run();

  await logAdminEvent(c.env.DB, "MEMBER_ROLE_CHANGED", {
    detail: `${userId} -> ${role}`,
    actor,
    tenantId,
  });

  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// DELETE /:userId  — remove a member from this tenant org
// ------------------------------------------------------------------
membersRoutes.delete("/:userId", async (c) => {
  const tenantId = c.get("tenantId") as string | undefined;
  if (!tenantId) return c.json({ error: "Tenant required" }, 400);

  const actor = await resolveActorContext(c);
  const tenantRow = await c.env.DB.prepare(
    "SELECT parent_id AS parentId FROM tenants WHERE id = ?"
  )
    .bind(tenantId)
    .first<{ parentId: string | null }>();
  if (!canManageMembers(actor, tenantId, tenantRow?.parentId ?? null)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const userId = c.req.param("userId");
  const orgId = await getTenantOrgId(c);
  if (!orgId) return c.json({ error: "Tenant has no organization" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT role FROM member WHERE userId = ? AND organizationId = ?"
  )
    .bind(userId, orgId)
    .first<{ role: string }>();
  if (!existing) return c.json({ error: "Member not found" }, 404);

  if (existing.role === ROLES.TENANT_OPERATOR) {
    const count = await operatorCount(c, orgId);
    if (count <= 1) {
      return c.json({ error: "Cannot remove the last tenant operator" }, 409);
    }
  }

  await c.env.DB.prepare(
    "DELETE FROM member WHERE userId = ? AND organizationId = ?"
  )
    .bind(userId, orgId)
    .run();

  await logAdminEvent(c.env.DB, "MEMBER_REMOVED", {
    detail: userId,
    actor,
    tenantId,
  });

  return c.json({ ok: true });
});
