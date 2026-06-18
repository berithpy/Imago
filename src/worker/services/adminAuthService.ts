import { and, eq, isNull, sql } from "drizzle-orm";
import { auth } from "../lib/auth";
import { logAdminEvent } from "../lib/adminLog";
import { IMAGO_ORG_SLUG, ROLES, type ActorContext } from "../lib/roles";
import { appConfig, member, organization, tenants, user } from "../lib/schema";
import { ServiceError, type ServiceCtx } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns true if the given user is a member of the platform `imago` org
 * with role `imago_operator` (the post-migration replacement for the
 * legacy `is_super_admin` flag).
 */
export async function isImagoOperator(ctx: ServiceCtx, userId: string): Promise<boolean> {
  const row = await ctx.db
    .select({ id: member.id })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(
      and(
        eq(member.userId, userId),
        eq(organization.slug, IMAGO_ORG_SLUG),
        eq(member.role, ROLES.IMAGO_OPERATOR)
      )
    )
    .limit(1)
    .get();
  return !!row;
}

/**
 * Decide whether a magic link should be sent for the given email and
 * dispatch it via better-auth when so. Always resolves to `void` — the
 * route should always respond `{ ok: true }` to avoid email enumeration.
 *
 * Eligibility: the email must belong to a known user that is either an
 * Imago operator or has at least one membership in a non-deleted tenant.
 *
 * Throws `VALIDATION` for malformed email; otherwise never throws.
 */
export async function requestAdminMagicLink(
  ctx: ServiceCtx,
  input: { rawEmail: unknown; appOrigin: string; requestHeaders: Headers }
): Promise<void> {
  const email = typeof input.rawEmail === "string" ? input.rawEmail.trim().toLowerCase() : "";
  if (!email || !EMAIL_RE.test(email)) {
    throw new ServiceError("VALIDATION", "Valid email required");
  }

  const found = await ctx.db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email))
    .get();

  if (!found) return;

  let shouldSend = false;
  if (await isImagoOperator(ctx, found.id)) {
    shouldSend = true;
  } else {
    const m = await ctx.db
      .select({ id: member.id })
      .from(member)
      .innerJoin(tenants, eq(tenants.organizationId, member.organizationId))
      .where(and(eq(member.userId, found.id), isNull(tenants.deletedAt)))
      .limit(1)
      .get();
    if (m) shouldSend = true;
  }

  if (!shouldSend) return;

  try {
    await auth(ctx.env, input.appOrigin).api.signInMagicLink({
      body: { email, callbackURL: "/login/resolve" },
      headers: input.requestHeaders,
    });
  } catch (err) {
    console.error("[login/magic-link] Failed to send magic link:", err);
  }
}

// ------------------------------------------------------------------
// Admin recovery flows (no auth required � locked-out admin entry points)
// ------------------------------------------------------------------

/**
 * Wipe the admin user (cascades to session + account) so `/api/tenant/setup`
 * can run again. Guarded by `ADMIN_RESET_SECRET`. Emits `ADMIN_RECOVER`.
 * Throws `FORBIDDEN` if the secret does not match.
 */
export async function recoverAdmin(
  ctx: ServiceCtx,
  input: { secret: string | undefined }
): Promise<void> {
  if (!input.secret || input.secret !== ctx.env.ADMIN_RESET_SECRET) {
    throw new ServiceError("FORBIDDEN", "Invalid reset secret");
  }
  await ctx.db.delete(user).run();
  await logAdminEvent(ctx.db, "ADMIN_RECOVER", { actorTypeOverride: "system" });
}

/**
 * Send a magic-link to the configured `recovery_email` (if any). Always
 * resolves silently � never reveals whether a recovery email is configured
 * or whether dispatch succeeded.
 */
export async function recoverAdminByEmail(
  ctx: ServiceCtx,
  input: { appOrigin: string; requestHeaders: Headers }
): Promise<void> {
  const row = await ctx.db
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(eq(appConfig.key, "recovery_email"))
    .get();
  if (!row) return;

  try {
    await auth(ctx.env, input.appOrigin).api.signInMagicLink({
      body: { email: row.value, callbackURL: "/login/resolve" },
      headers: input.requestHeaders,
    });
  } catch (err) {
    console.error("[recover-by-email] Failed to send magic link:", err);
  }
}

/**
 * Send a magic link to the registered admin email � only when the supplied
 * address matches it. Always resolves silently to avoid leaking whether the
 * email is the admin. Throws `VALIDATION` for malformed input.
 */
export async function requestLegacyAdminMagicLink(
  ctx: ServiceCtx,
  input: { rawEmail: unknown; appOrigin: string; requestHeaders: Headers }
): Promise<void> {
  const email = typeof input.rawEmail === "string" ? input.rawEmail.trim().toLowerCase() : "";
  if (!email || !EMAIL_RE.test(email)) {
    throw new ServiceError("VALIDATION", "Valid email required");
  }

  const adminRow = await ctx.db.select({ email: user.email }).from(user).limit(1).get();
  if (!adminRow || adminRow.email.toLowerCase() !== email) return;

  try {
    await auth(ctx.env, input.appOrigin).api.signInMagicLink({
      body: { email, callbackURL: "/login/resolve" },
      headers: input.requestHeaders,
    });
  } catch (err) {
    console.error("[admin/magic-link] Failed to send magic link:", err);
  }
}
// ------------------------------------------------------------------
// Platform user management (operator-only)
// ------------------------------------------------------------------

import { auth as authFactory } from "../lib/auth";
import { logAdminEvent as logEvent } from "../lib/adminLog";
import { IMAGO_ORG_SLUG as PLATFORM_ORG_SLUG, ROLES as ROLE_MAP } from "../lib/roles";

export async function listPlatformUsers(
  ctx: ServiceCtx,
  input: {
    actor: ActorContext;
    tenantId?: string;
    q?: string;
    page?: number;
    pageSize?: number;
    superAdminOnly?: boolean;
  }
): Promise<{ users: unknown[]; total: number }> {
  if (!input.actor.user) throw new ServiceError("UNAUTHORIZED", "Unauthorized");
  if (!input.actor.superAdmin) throw new ServiceError("FORBIDDEN", "Forbidden");

  // `is_super_admin` is derived from membership in the platform org.
  // Keep it as 0/1 for API parity with existing UI payload contracts.
  const superAdminExpr = sql<number>`(
    EXISTS (
      SELECT 1 FROM member im
      JOIN organization io ON io.id = im.organizationId
      WHERE im.userId = ${user.id}
        AND io.slug = ${PLATFORM_ORG_SLUG}
        AND im.role = ${ROLE_MAP.IMAGO_OPERATOR}
    )
  )`;

  const q = (input.q ?? "").trim().toLowerCase();
  const filters: ReturnType<typeof sql>[] = [];

  if (input.tenantId) {
    filters.push(eq(tenants.id, input.tenantId));
  }

  if (q) {
    const like = `%${q}%`;
    filters.push(
      sql`(
        lower(${user.name}) LIKE ${like}
        OR lower(${user.email}) LIKE ${like}
        OR lower(ifnull(${tenants.name}, '')) LIKE ${like}
      )`
    );
  }

  if (input.superAdminOnly) {
    filters.push(sql`${superAdminExpr} = 1`);
  }

  const whereClause = filters.length ? and(...filters) : undefined;

  const totalRow = await (whereClause
    ? ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .leftJoin(member, eq(member.userId, user.id))
      .leftJoin(organization, eq(organization.id, member.organizationId))
      .leftJoin(tenants, eq(tenants.organizationId, organization.id))
      .where(whereClause)
      .get()
    : ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .leftJoin(member, eq(member.userId, user.id))
      .leftJoin(organization, eq(organization.id, member.organizationId))
      .leftJoin(tenants, eq(tenants.organizationId, organization.id))
      .get());

  const total = Number(totalRow?.count ?? 0);

  const hasPagination = typeof input.page === "number" && typeof input.pageSize === "number";
  const rows = await (hasPagination
    ? whereClause
      ? ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          is_super_admin: superAdminExpr,
          createdAt: user.createdAt,
          role: member.role,
          tenant_id: tenants.id,
          tenant_name: tenants.name,
        })
        .from(user)
        .leftJoin(member, eq(member.userId, user.id))
        .leftJoin(organization, eq(organization.id, member.organizationId))
        .leftJoin(tenants, eq(tenants.organizationId, organization.id))
        .where(whereClause)
        .orderBy(sql`${user.createdAt} DESC`)
        .limit(input.pageSize as number)
        .offset(((input.page as number) - 1) * (input.pageSize as number))
        .all()
      : ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          is_super_admin: superAdminExpr,
          createdAt: user.createdAt,
          role: member.role,
          tenant_id: tenants.id,
          tenant_name: tenants.name,
        })
        .from(user)
        .leftJoin(member, eq(member.userId, user.id))
        .leftJoin(organization, eq(organization.id, member.organizationId))
        .leftJoin(tenants, eq(tenants.organizationId, organization.id))
        .orderBy(sql`${user.createdAt} DESC`)
        .limit(input.pageSize as number)
        .offset(((input.page as number) - 1) * (input.pageSize as number))
        .all()
    : whereClause
      ? ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          is_super_admin: superAdminExpr,
          createdAt: user.createdAt,
          role: member.role,
          tenant_id: tenants.id,
          tenant_name: tenants.name,
        })
        .from(user)
        .leftJoin(member, eq(member.userId, user.id))
        .leftJoin(organization, eq(organization.id, member.organizationId))
        .leftJoin(tenants, eq(tenants.organizationId, organization.id))
        .where(whereClause)
        .orderBy(sql`${user.createdAt} DESC`)
        .all()
      : ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          is_super_admin: superAdminExpr,
          createdAt: user.createdAt,
          role: member.role,
          tenant_id: tenants.id,
          tenant_name: tenants.name,
        })
        .from(user)
        .leftJoin(member, eq(member.userId, user.id))
        .leftJoin(organization, eq(organization.id, member.organizationId))
        .leftJoin(tenants, eq(tenants.organizationId, organization.id))
        .orderBy(sql`${user.createdAt} DESC`)
        .all());

  const users = rows.map((r) => ({
    ...r,
    createdAt:
      r.createdAt instanceof Date
        ? Math.floor(r.createdAt.getTime() / 1000)
        : (r.createdAt as unknown as number),
    is_super_admin: Number(r.is_super_admin ?? 0),
  }));

  return { users, total };
}

export type LegacyInviteInput = {
  actor: ActorContext;
  email: string;
  name: string;
  appOrigin: string;
  requestHeaders: Headers;
  tenantId?: string | null;
};

/**
 * Legacy endpoint behind POST /users/invite. Creates an unattached
 * platform user (no tenant membership) and dispatches a magic link.
 * Superseded by POST /admin/members/invite for tenant-scoped invites.
 * Restricted to superAdmin so tenant operators cannot silently create
 * unattached users.
 */
export async function inviteLegacyPlatformUser(
  ctx: ServiceCtx,
  input: LegacyInviteInput
): Promise<{ email: string; name: string }> {
  if (!input.actor.user) throw new ServiceError("UNAUTHORIZED", "Unauthorized");
  if (!input.actor.superAdmin) throw new ServiceError("FORBIDDEN", "Forbidden");

  const email = input.email?.trim();
  const name = input.name?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ServiceError("VALIDATION", "Valid email required");
  }
  if (!name) throw new ServiceError("VALIDATION", "Name required");

  try {
    await authFactory(ctx.env, input.appOrigin).api.signUpEmail({
      body: { email, name, password: crypto.randomUUID() },
    });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    if (e?.message?.includes("already") || e?.status === 422) {
      throw new ServiceError("CONFLICT", "User with this email already exists");
    }
    throw new ServiceError("INTERNAL", "Failed to create user");
  }

  try {
    await authFactory(ctx.env, input.appOrigin).api.signInMagicLink({
      body: { email, callbackURL: "/login/resolve" },
      headers: input.requestHeaders,
    });
  } catch (err) {
    console.error("[users/invite] Failed to send magic link:", err);
  }

  await logEvent(ctx.db, "USER_INVITED", {
    detail: email,
    actor: input.actor,
    tenantId: input.tenantId ?? null,
  });

  return { email, name };
}