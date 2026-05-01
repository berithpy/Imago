import { and, count, eq, sql } from "drizzle-orm";
import { auth } from "../lib/auth";
import { logAdminEvent } from "../lib/adminLog";
import { invitedUserHtml, sendEmail } from "../lib/email";
import {
  canManageMembers,
  isTenantRole,
  ROLES,
  TENANT_ROLE_VALUES,
  type ActorContext,
  type TenantRole,
} from "../lib/roles";
import { member, tenants, user } from "../lib/schema";
import { ServiceError, type ServiceCtx } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MemberRow = {
  userId: string;
  email: string;
  name: string;
  role: string;
  joinedAt: number;
};

async function getTenantOrgId(ctx: ServiceCtx, tenantId: string | undefined): Promise<string | null> {
  if (!tenantId) return null;
  const row = await ctx.db
    .select({ organizationId: tenants.organizationId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();
  return row?.organizationId ?? null;
}

async function getTenantParentId(
  ctx: ServiceCtx,
  tenantId: string
): Promise<string | null> {
  const row = await ctx.db
    .select({ parentId: tenants.parentId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();
  return row?.parentId ?? null;
}

async function operatorCount(ctx: ServiceCtx, orgId: string): Promise<number> {
  const row = await ctx.db
    .select({ n: count() })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.role, ROLES.TENANT_OPERATOR)))
    .get();
  return row?.n ?? 0;
}

/**
 * List all members of the tenant. Returns `[]` when the tenant has no
 * linked organization (defensive — shouldn't happen post-onboarding).
 * Caller is responsible for tenant-level read authorization.
 */
export async function listMembers(
  ctx: ServiceCtx,
  tenantId: string | undefined
): Promise<MemberRow[]> {
  const orgId = await getTenantOrgId(ctx, tenantId);
  if (!orgId) return [];

  const rows = await ctx.db
    .select({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: member.role,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))
    .orderBy(sql`${member.createdAt} ASC`)
    .all();

  // Drizzle returns createdAt as a Date because of the schema mode; coerce
  // to unix seconds to keep API parity with the original raw-SQL handler.
  return rows.map((r) => ({
    ...r,
    joinedAt:
      r.joinedAt instanceof Date
        ? Math.floor(r.joinedAt.getTime() / 1000)
        : (r.joinedAt as unknown as number),
  }));
}

export type InviteMemberInput = {
  tenantId: string | undefined;
  actor: ActorContext;
  email: string | undefined;
  name: string | undefined;
  role: string | undefined;
  appOrigin: string;
  requestHeaders: Headers;
};

/**
 * Invite a user to the tenant org with a given role. Creates the user via
 * better-auth if needed, attaches them to the org, sends a magic link
 * for activation, and dispatches a notification email. Emits
 * `MEMBER_INVITED`. Throws standard `ServiceError` codes.
 */
export async function inviteMember(
  ctx: ServiceCtx,
  input: InviteMemberInput
): Promise<{ userId: string; email: string; role: TenantRole }> {
  if (!input.tenantId) throw new ServiceError("VALIDATION", "Tenant required");

  const parentId = await getTenantParentId(ctx, input.tenantId);
  if (!canManageMembers(input.actor, input.tenantId, parentId)) {
    throw new ServiceError("FORBIDDEN", "Forbidden");
  }

  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim();
  if (!email || !EMAIL_RE.test(email)) {
    throw new ServiceError("VALIDATION", "Valid email required");
  }
  if (!name) throw new ServiceError("VALIDATION", "Name required");
  if (!input.role || !isTenantRole(input.role)) {
    throw new ServiceError(
      "VALIDATION",
      `Invalid role. Expected one of ${TENANT_ROLE_VALUES.join(", ")}.`
    );
  }
  const role = input.role as TenantRole;

  const orgId = await getTenantOrgId(ctx, input.tenantId);
  if (!orgId) throw new ServiceError("VALIDATION", "Tenant has no organization");

  const existing = await ctx.db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email))
    .get();

  if (!existing) {
    try {
      await auth(ctx.env, input.appOrigin).api.signUpEmail({
        body: { email, name, password: crypto.randomUUID() },
      });
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      if (!(e?.message?.includes("already") || e?.status === 422)) {
        throw new ServiceError("INTERNAL", "Failed to create user");
      }
    }
  }

  const userRow = await ctx.db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email))
    .get();
  if (!userRow) throw new ServiceError("INTERNAL", "Failed to create user");

  const dup = await ctx.db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userRow.id), eq(member.organizationId, orgId)))
    .get();
  if (dup) throw new ServiceError("CONFLICT", "User is already a member");

  await ctx.db
    .insert(member)
    .values({
      id: crypto.randomUUID(),
      userId: userRow.id,
      organizationId: orgId,
      role,
    })
    .run();

  // Best-effort magic link for activation.
  try {
    await auth(ctx.env, input.appOrigin).api.signInMagicLink({
      body: { email, callbackURL: "/login/resolve" },
      headers: input.requestHeaders,
    });
  } catch (err) {
    console.error("[members/invite] magic link failed:", err);
  }

  // Best-effort notification email.
  try {
    await sendEmail(ctx.env.RESEND_API_KEY, ctx.env.FROM_EMAIL, {
      to: email,
      subject: "You've been invited to Imago",
      html: invitedUserHtml("the team", input.appOrigin, email),
    });
  } catch (err) {
    console.error("[members/invite] email failed:", err);
  }

  await logAdminEvent(ctx.env.DB, "MEMBER_INVITED", {
    detail: email,
    actor: input.actor,
    tenantId: input.tenantId,
  });

  return { userId: userRow.id, email, role };
}

/**
 * Change the role of an existing member. Refuses to demote the last
 * `tenant_operator` (would orphan the tenant). Emits `MEMBER_ROLE_CHANGED`.
 */
export async function changeMemberRole(
  ctx: ServiceCtx,
  input: {
    tenantId: string | undefined;
    userId: string;
    role: string | undefined;
    actor: ActorContext;
  }
): Promise<void> {
  if (!input.tenantId) throw new ServiceError("VALIDATION", "Tenant required");

  const parentId = await getTenantParentId(ctx, input.tenantId);
  if (!canManageMembers(input.actor, input.tenantId, parentId)) {
    throw new ServiceError("FORBIDDEN", "Forbidden");
  }

  if (!input.role || !isTenantRole(input.role)) {
    throw new ServiceError(
      "VALIDATION",
      `Invalid role. Expected one of ${TENANT_ROLE_VALUES.join(", ")}.`
    );
  }
  const role = input.role as TenantRole;

  const orgId = await getTenantOrgId(ctx, input.tenantId);
  if (!orgId) throw new ServiceError("VALIDATION", "Tenant has no organization");

  const existing = await ctx.db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, input.userId), eq(member.organizationId, orgId)))
    .get();
  if (!existing) throw new ServiceError("NOT_FOUND", "Member not found");

  if (existing.role === ROLES.TENANT_OPERATOR && role !== ROLES.TENANT_OPERATOR) {
    const c = await operatorCount(ctx, orgId);
    if (c <= 1) {
      throw new ServiceError("CONFLICT", "Cannot demote the last tenant operator");
    }
  }

  await ctx.db
    .update(member)
    .set({ role })
    .where(and(eq(member.userId, input.userId), eq(member.organizationId, orgId)))
    .run();

  await logAdminEvent(ctx.env.DB, "MEMBER_ROLE_CHANGED", {
    detail: `${input.userId} -> ${role}`,
    actor: input.actor,
    tenantId: input.tenantId,
  });
}

/**
 * Remove a member from the tenant org. Refuses to remove the last
 * `tenant_operator`. Emits `MEMBER_REMOVED`.
 */
export async function removeMember(
  ctx: ServiceCtx,
  input: { tenantId: string | undefined; userId: string; actor: ActorContext }
): Promise<void> {
  if (!input.tenantId) throw new ServiceError("VALIDATION", "Tenant required");

  const parentId = await getTenantParentId(ctx, input.tenantId);
  if (!canManageMembers(input.actor, input.tenantId, parentId)) {
    throw new ServiceError("FORBIDDEN", "Forbidden");
  }

  const orgId = await getTenantOrgId(ctx, input.tenantId);
  if (!orgId) throw new ServiceError("VALIDATION", "Tenant has no organization");

  const existing = await ctx.db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, input.userId), eq(member.organizationId, orgId)))
    .get();
  if (!existing) throw new ServiceError("NOT_FOUND", "Member not found");

  if (existing.role === ROLES.TENANT_OPERATOR) {
    const c = await operatorCount(ctx, orgId);
    if (c <= 1) {
      throw new ServiceError("CONFLICT", "Cannot remove the last tenant operator");
    }
  }

  await ctx.db
    .delete(member)
    .where(and(eq(member.userId, input.userId), eq(member.organizationId, orgId)))
    .run();

  await logAdminEvent(ctx.env.DB, "MEMBER_REMOVED", {
    detail: input.userId,
    actor: input.actor,
    tenantId: input.tenantId,
  });
}
