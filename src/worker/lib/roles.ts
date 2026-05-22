import type { Bindings } from "../index";
import { auth } from "./auth";

// Minimal subset of Hono Context we use, so callers can pass any Context
// generic shape without TypeScript variance complaints. Methods take the
// loose `any` shape that all Hono Context flavors are assignable to.
export type RoleContext = {
  env: Bindings;
  req: { raw: Request };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: any): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(key: any, value: any): void;
};

// ------------------------------------------------------------------
// Role constants
// Stored values stay technical so the DB never needs a migration when we
// rename UI vocabulary. Display names live in `roleDisplay`.
// ------------------------------------------------------------------

/**
 * Slug of the platform-wide organization. Members of this org with role
 * `imago_operator` are platform staff (the former `is_super_admin` flag).
 * Created by migration 0011; reserved in `RESERVED_TENANT_SLUGS`.
 */
export const IMAGO_ORG_SLUG = "imago";
export const IMAGO_ORG_ID = "imago-platform";

export const ROLES = {
  IMAGO_OPERATOR: "imago_operator",
  TENANT_OPERATOR: "tenant_operator",
  SUB_TENANT_OPERATOR: "sub_tenant_operator",
  TENANT_COLLABORATOR: "tenant_collaborator",
} as const;

export type TenantRole =
  | typeof ROLES.TENANT_OPERATOR
  | typeof ROLES.SUB_TENANT_OPERATOR
  | typeof ROLES.TENANT_COLLABORATOR;

export type ImagoRole = typeof ROLES.IMAGO_OPERATOR;

export type ActorType =
  | "system"
  | "imago_operator"
  | "tenant_operator"
  | "sub_tenant_operator"
  | "tenant_collaborator"
  | "parent_operator";

/** Neutral display vocabulary. Change here without touching stored values. */
export const roleDisplay: Record<string, string> = {
  imago_operator: "Imago operator",
  tenant_operator: "Account owner",
  sub_tenant_operator: "Workspace lead",
  tenant_collaborator: "Collaborator",
};

/** Valid stored values for `member.role` in a tenant organization. */
export const TENANT_ROLE_VALUES: TenantRole[] = [
  ROLES.TENANT_OPERATOR,
  ROLES.SUB_TENANT_OPERATOR,
  ROLES.TENANT_COLLABORATOR,
];

/** Valid stored values for `member.role` in the Imago platform organization. */
export const IMAGO_ROLE_VALUES: ImagoRole[] = [ROLES.IMAGO_OPERATOR];

export function isTenantRole(value: string): value is TenantRole {
  return (TENANT_ROLE_VALUES as string[]).includes(value);
}

export function isImagoRole(value: string): value is ImagoRole {
  return (IMAGO_ROLE_VALUES as string[]).includes(value);
}

/**
 * Throws if `value` is not a valid tenant-org role. Use at every site that
 * writes to `member.role` in a tenant organization. Replaces the safety we
 * would have gotten from a `roles` lookup table FK.
 */
export function assertTenantRole(value: string): TenantRole {
  if (!isTenantRole(value)) {
    throw new Error(`Invalid tenant role: ${value}. Expected one of ${TENANT_ROLE_VALUES.join(", ")}.`);
  }
  return value;
}

export function assertImagoRole(value: string): ImagoRole {
  if (!isImagoRole(value)) {
    throw new Error(`Invalid Imago role: ${value}. Expected one of ${IMAGO_ROLE_VALUES.join(", ")}.`);
  }
  return value;
}

// ------------------------------------------------------------------
// Actor context
// ------------------------------------------------------------------

export type Membership = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: TenantRole;
  parentTenantId: string | null;
  parentTenantSlug: string | null;
};

export type ActorContext = {
  user: { id: string; email: string; name: string } | null;
  superAdmin: boolean;
  memberships: Membership[];
};

const ANON: ActorContext = { user: null, superAdmin: false, memberships: [] };

/**
 * Resolves the current actor from a request: better-auth session + user row +
 * full membership graph (with parent slugs). Returns ANON if no session.
 *
 * Memberships use `member.role` values from `TENANT_ROLE_VALUES`. Legacy
 * `"member"` rows are coerced to `tenant_operator` for backwards compat.
 */
export async function resolveActorContext(c: RoleContext): Promise<ActorContext> {
  const cached = c.get("actorContext") as ActorContext | undefined;
  if (cached) return cached;

  let session: { user?: { email?: string; id?: string; name?: string } } | null = null;
  try {
    const origin = new URL(c.req.raw.url).origin;
    session = await auth(c.env, origin).api.getSession({
      headers: c.req.raw.headers,
    });
  } catch {
    session = null;
  }
  if (!session?.user?.email) {
    c.set("actorContext", ANON);
    return ANON;
  }
  const email = session.user.email;

  const user = await c.env.DB.prepare(
    "SELECT id, name, email FROM user WHERE lower(email) = lower(?)"
  )
    .bind(email)
    .first<{ id: string; name: string; email: string }>();
  if (!user) {
    c.set("actorContext", ANON);
    return ANON;
  }

  // Platform-org membership: a single row in the `imago` org with role
  // `imago_operator` makes the user a platform staff member. Replaces the
  // legacy `user.is_super_admin` flag (removed in migration 0011).
  const imagoMember = await c.env.DB.prepare(
    `SELECT 1 FROM member m
     INNER JOIN organization o ON o.id = m.organizationId
     WHERE m.userId = ? AND o.slug = ? AND m.role = ?
     LIMIT 1`
  )
    .bind(user.id, IMAGO_ORG_SLUG, ROLES.IMAGO_OPERATOR)
    .first();
  const superAdmin = !!imagoMember;

  const { results } = await c.env.DB.prepare(
    `SELECT t.id   AS tenantId,
            t.slug AS tenantSlug,
            t.name AS tenantName,
            m.role AS role,
            t.parent_id AS parentTenantId,
            p.slug      AS parentTenantSlug
     FROM member m
     INNER JOIN organization o ON o.id = m.organizationId
     INNER JOIN tenants t      ON t.organization_id = o.id
     LEFT  JOIN tenants p      ON p.id = t.parent_id
     WHERE m.userId = ? AND t.deleted_at IS NULL`
  )
    .bind(user.id)
    .all<{
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      role: string;
      parentTenantId: string | null;
      parentTenantSlug: string | null;
    }>();

  const memberships: Membership[] = results.map((r) => ({
    tenantId: r.tenantId,
    tenantSlug: r.tenantSlug,
    tenantName: r.tenantName,
    role: isTenantRole(r.role) ? r.role : ROLES.TENANT_OPERATOR,
    parentTenantId: r.parentTenantId,
    parentTenantSlug: r.parentTenantSlug,
  }));

  const ctx: ActorContext = {
    user: { id: user.id, email: user.email, name: user.name },
    superAdmin,
    memberships,
  };
  c.set("actorContext", ctx);
  return ctx;
}

// ------------------------------------------------------------------
// Capability functions
// Each takes the actor and the relevant tenant id; returns boolean.
// ------------------------------------------------------------------

function membershipFor(actor: ActorContext, tenantId: string): Membership | undefined {
  return actor.memberships.find((m) => m.tenantId === tenantId);
}

/** True if the actor is the operator of `tenantId`'s parent tenant. */
function parentOperatorOf(actor: ActorContext, tenantId: string): boolean {
  const target = actor.memberships.find((m) => m.tenantId === tenantId);
  // The actor may not be a member of the sub-tenant directly. We need the
  // sub-tenant's parent id even when actor has no membership on the sub.
  // Callers should use parentOperatorOfTenant which queries the DB; this
  // only handles the "I'm a member of the sub-tenant" case.
  if (!target?.parentTenantId) return false;
  const parent = actor.memberships.find((m) => m.tenantId === target.parentTenantId);
  return parent?.role === ROLES.TENANT_OPERATOR;
}

/** Only the platform-level Imago operator can create top-level tenants. */
export function canCreateTopLevelTenant(actor: ActorContext): boolean {
  return actor.superAdmin;
}

/**
 * Sub-tenants may be created by the Imago operator, or by the
 * `tenant_operator` of the *parent* (top-level) tenant. The parent must
 * itself have no parent — depth ≤ 1.
 */
export function canCreateSubTenant(
  actor: ActorContext,
  parent: { id: string; parentId: string | null }
): boolean {
  if (parent.parentId) return false; // depth-2 attempt
  if (actor.superAdmin) return true;
  const m = membershipFor(actor, parent.id);
  return m?.role === ROLES.TENANT_OPERATOR;
}

/** CRUD on galleries and photos within a tenant. */
export function canCrudGalleries(actor: ActorContext, tenantId: string): boolean {
  if (actor.superAdmin) return true;
  const m = membershipFor(actor, tenantId);
  return !!m; // any role on the tenant can CRUD galleries
}

/**
 * Manage members on a tenant. Studio owner manages own + sub-tenants;
 * studio lead manages only their own sub-tenant. Collaborators cannot.
 * Note: parent-tenant `tenant_collaborator` membership does NOT confer
 * sub-tenant access — must be member of the sub-tenant itself.
 */
export function canManageMembers(
  actor: ActorContext,
  tenantId: string,
  tenantParentId: string | null
): boolean {
  if (actor.superAdmin) return true;
  const direct = membershipFor(actor, tenantId);
  if (direct?.role === ROLES.TENANT_OPERATOR) return true;
  if (direct?.role === ROLES.SUB_TENANT_OPERATOR) return true;
  // Parent operator may manage members on their sub-tenants.
  if (tenantParentId) {
    const parent = membershipFor(actor, tenantParentId);
    if (parent?.role === ROLES.TENANT_OPERATOR) return true;
  }
  return false;
}

/** Plan / billing — only top-level tenant_operator and Imago op. */
export function canManageBilling(actor: ActorContext, tenantId: string): boolean {
  if (actor.superAdmin) return true;
  const m = membershipFor(actor, tenantId);
  return m?.role === ROLES.TENANT_OPERATOR && m.parentTenantId === null;
}

/** Soft-delete a tenant — top-level operator on own, or Imago op. */
export function canSoftDeleteTenant(actor: ActorContext, tenantId: string): boolean {
  if (actor.superAdmin) return true;
  const m = membershipFor(actor, tenantId);
  return m?.role === ROLES.TENANT_OPERATOR;
}

/** Hard-purge — Imago op only. */
export function canHardPurgeTenant(actor: ActorContext): boolean {
  return actor.superAdmin;
}

// ------------------------------------------------------------------
// Actor-type classification for admin-log writes
// ------------------------------------------------------------------

/**
 * Determines what `actor_type` to record for a write into `tenantId`.
 * - `system` if no actor (e.g. setup / recovery flow)
 * - `imago_operator` if super-admin acting on a tenant they aren't a member of
 *   OR any super-admin write (always logged as imago_operator per spec)
 * - `parent_operator` if actor is the tenant_operator of `tenantId`'s parent
 *   but is writing into the sub-tenant
 * - otherwise the actor's own member role on `tenantId`
 */
export function classifyActor(
  actor: ActorContext | null,
  tenantId: string | null,
  tenantParentId: string | null
): ActorType {
  if (!actor || !actor.user) return "system";
  if (actor.superAdmin) return "imago_operator";
  if (!tenantId) return "system";

  const direct = membershipFor(actor, tenantId);
  if (direct) return direct.role;

  if (tenantParentId) {
    const parent = membershipFor(actor, tenantParentId);
    if (parent?.role === ROLES.TENANT_OPERATOR) return "parent_operator";
  }
  return "system";
}

// silence unused-warning for the inline helper kept for future use
void parentOperatorOf;
