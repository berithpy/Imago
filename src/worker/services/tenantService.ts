import { and, eq, isNull, sql } from "drizzle-orm";
import { RESERVED_TENANT_SLUGS } from "../../shared/reservedSlugs";
import { organization, tenants } from "../lib/schema";
import { logAdminEvent } from "../lib/adminLog";
import {
  canCreateSubTenant,
  canManageMembers,
  ROLES,
  type ActorContext,
} from "../lib/roles";
import { ServiceError, type ServiceCtx } from "./types";

type TenantRow = {
  id: string;
  parentId: string | null;
  brandingOverrides: string | null;
};

async function loadTenantById(ctx: ServiceCtx, tenantId: string): Promise<TenantRow | null> {
  const row = await ctx.db
    .select({
      id: tenants.id,
      parentId: tenants.parentId,
      brandingOverrides: tenants.brandingOverrides,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();
  return row ?? null;
}

function safeParse(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/**
 * Read a tenant's branding overrides. Returns `{}` when the tenant id is
 * not provided (route mounted without tenant scope) or when no overrides
 * are set; never throws.
 */
export async function getBranding(
  ctx: ServiceCtx,
  tenantId: string | undefined
): Promise<{ branding: Record<string, unknown> }> {
  if (!tenantId) return { branding: {} };
  const tenant = await loadTenantById(ctx, tenantId);
  if (!tenant) return { branding: {} };
  return { branding: tenant.brandingOverrides ? safeParse(tenant.brandingOverrides) : {} };
}

/**
 * Replace branding overrides for the tenant. Validates `body` is a
 * non-array object, enforces operator-level permission, persists the
 * blob as JSON, and emits a `BRANDING_UPDATED` audit event.
 *
 * Throws `NOT_FOUND` if the tenant doesn't exist, `FORBIDDEN` if the
 * actor lacks permission, `VALIDATION` if the body is not a JSON object.
 */
export async function updateBranding(
  ctx: ServiceCtx,
  input: { tenantId: string | undefined; body: unknown; actor: ActorContext }
): Promise<{ branding: Record<string, unknown> }> {
  if (!input.tenantId) throw new ServiceError("NOT_FOUND", "Tenant not found");
  const tenant = await loadTenantById(ctx, input.tenantId);
  if (!tenant) throw new ServiceError("NOT_FOUND", "Tenant not found");

  if (!canManageMembers(input.actor, tenant.id, tenant.parentId)) {
    throw new ServiceError("FORBIDDEN", "Forbidden");
  }

  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    throw new ServiceError("VALIDATION", "Body must be a JSON object");
  }
  const body = input.body as Record<string, unknown>;

  await ctx.db
    .update(tenants)
    .set({ brandingOverrides: JSON.stringify(body) })
    .where(eq(tenants.id, tenant.id))
    .run();

  await logAdminEvent(ctx.env.DB, "BRANDING_UPDATED", {
    actor: input.actor,
    tenantId: tenant.id,
  });

  return { branding: body };
}

/**
 * Clear branding overrides (revert to inheriting from parent / defaults).
 * Same authorization as `updateBranding`. Emits `BRANDING_CLEARED`.
 */
export async function clearBranding(
  ctx: ServiceCtx,
  input: { tenantId: string | undefined; actor: ActorContext }
): Promise<void> {
  if (!input.tenantId) throw new ServiceError("NOT_FOUND", "Tenant not found");
  const tenant = await loadTenantById(ctx, input.tenantId);
  if (!tenant) throw new ServiceError("NOT_FOUND", "Tenant not found");

  if (!canManageMembers(input.actor, tenant.id, tenant.parentId)) {
    throw new ServiceError("FORBIDDEN", "Forbidden");
  }

  await ctx.db
    .update(tenants)
    .set({ brandingOverrides: null })
    .where(eq(tenants.id, tenant.id))
    .run();

  await logAdminEvent(ctx.env.DB, "BRANDING_CLEARED", {
    actor: input.actor,
    tenantId: tenant.id,
  });
}

// ------------------------------------------------------------------
// Slug validation, tenant CRUD, sub-tenants
// ------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9-]+$/;

export type SlugCheckResult = {
  valid: boolean;
  available: boolean;
  reserved: boolean;
};

/**
 * Validate a slug for syntax, reserved-list membership, and uniqueness.
 * Public � used by both the operator and tenant signup flows.
 */
export async function checkTenantSlug(
  ctx: ServiceCtx,
  slug: string
): Promise<SlugCheckResult> {
  if (!SLUG_RE.test(slug)) {
    return { valid: false, available: false, reserved: false };
  }
  if (RESERVED_TENANT_SLUGS.includes(slug)) {
    return { valid: true, available: false, reserved: true };
  }
  const existing = await ctx.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .get();
  return { valid: true, available: !existing, reserved: false };
}

export type TenantSummary = {
  id: string;
  slug: string;
  name: string;
  organization_id: string | null;
  parent_id: string | null;
  deleted_at: number | null;
  created_at: number;
};

export type TenantListInput = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export type TenantListResult = {
  tenants: TenantSummary[];
  total: number;
};

/** List all tenants (super-admin view, includes soft-deleted). */
export async function listTenants(
  ctx: ServiceCtx,
  input: TenantListInput = {}
): Promise<TenantListResult> {
  const q = (input.q ?? "").trim().toLowerCase();
  const page = input.page;
  const pageSize = input.pageSize;
  const hasPagination = typeof page === "number" && typeof pageSize === "number";

  const whereClause = q
    ? sql`(lower(${tenants.name}) LIKE ${`%${q}%`} OR lower(${tenants.slug}) LIKE ${`%${q}%`})`
    : undefined;

  const totalRow = whereClause
    ? await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(tenants)
      .where(whereClause)
      .get()
    : await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(tenants)
      .get();
  const total = Number(totalRow?.count ?? 0);

  const rows = await (hasPagination
    ? whereClause
      ? ctx.db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          organization_id: tenants.organizationId,
          parent_id: tenants.parentId,
          deleted_at: tenants.deletedAt,
          created_at: tenants.createdAt,
        })
        .from(tenants)
        .where(whereClause)
        .orderBy(sql`created_at DESC`)
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all()
      : ctx.db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          organization_id: tenants.organizationId,
          parent_id: tenants.parentId,
          deleted_at: tenants.deletedAt,
          created_at: tenants.createdAt,
        })
        .from(tenants)
        .orderBy(sql`created_at DESC`)
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all()
    : whereClause
      ? ctx.db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          organization_id: tenants.organizationId,
          parent_id: tenants.parentId,
          deleted_at: tenants.deletedAt,
          created_at: tenants.createdAt,
        })
        .from(tenants)
        .where(whereClause)
        .orderBy(sql`created_at DESC`)
        .all()
      : ctx.db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          organization_id: tenants.organizationId,
          parent_id: tenants.parentId,
          deleted_at: tenants.deletedAt,
          created_at: tenants.createdAt,
        })
        .from(tenants)
        .orderBy(sql`created_at DESC`)
        .all());

  return { tenants: rows, total };
}

/**
 * Create a top-level tenant + linked organization atomically. Caller must
 * already be authorized (route enforces super-admin). Validates slug
 * shape, reserved-list, and uniqueness.
 */
export async function createTenant(
  ctx: ServiceCtx,
  input: { slug: string; name: string }
): Promise<{ id: string; slug: string; name: string; organization_id: string }> {
  if (!input.slug || !input.name) {
    throw new ServiceError("VALIDATION", "slug and name are required");
  }
  if (!SLUG_RE.test(input.slug)) {
    throw new ServiceError(
      "VALIDATION",
      "Slug must only contain lowercase letters, numbers, and dashes"
    );
  }
  if (RESERVED_TENANT_SLUGS.includes(input.slug)) {
    throw new ServiceError("VALIDATION", "Slug is reserved");
  }

  const existing = await ctx.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, input.slug))
    .get();
  if (existing) throw new ServiceError("CONFLICT", "Slug already in use");

  const tenantId = crypto.randomUUID();
  const orgId = crypto.randomUUID();

  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())"
    ).bind(orgId, input.name, input.slug),
    ctx.env.DB.prepare(
      "INSERT INTO tenants (id, slug, name, organization_id, created_at) VALUES (?, ?, ?, ?, unixepoch())"
    ).bind(tenantId, input.slug, input.name, orgId),
  ]);

  return { id: tenantId, slug: input.slug, name: input.name, organization_id: orgId };
}

/**
 * Create a sub-tenant under an existing parent. Authorization (super-admin
 * OR tenant_operator of parent) is enforced here. Depth = 1 is enforced
 * via `canCreateSubTenant`. Auto-grants the creator a sub_tenant_operator
 * membership when the creator is not super-admin.
 *
 * Throws `VALIDATION`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT` as appropriate.
 * Emits `SUB_TENANT_CREATED`.
 */
export async function createSubTenant(
  ctx: ServiceCtx,
  input: { parentId: string | undefined; slug: string | undefined; name: string | undefined; actor: ActorContext }
): Promise<{
  id: string;
  slug: string;
  name: string;
  organization_id: string;
  parent_id: string;
  deleted_at: null;
}> {
  if (!input.parentId || !input.slug || !input.name) {
    throw new ServiceError("VALIDATION", "parentId, slug, and name are required");
  }
  if (!SLUG_RE.test(input.slug)) {
    throw new ServiceError(
      "VALIDATION",
      "Slug must only contain lowercase letters, numbers, and dashes"
    );
  }
  if (RESERVED_TENANT_SLUGS.includes(input.slug)) {
    throw new ServiceError("VALIDATION", "Slug is reserved");
  }

  const parent = await ctx.db
    .select({ id: tenants.id, slug: tenants.slug, parentId: tenants.parentId })
    .from(tenants)
    .where(and(eq(tenants.id, input.parentId), isNull(tenants.deletedAt)))
    .get();
  if (!parent) throw new ServiceError("NOT_FOUND", "Parent tenant not found");

  if (!canCreateSubTenant(input.actor, { id: parent.id, parentId: parent.parentId })) {
    if (parent.parentId) {
      throw new ServiceError("VALIDATION", "Sub-tenants cannot have sub-tenants");
    }
    throw new ServiceError("FORBIDDEN", "Forbidden");
  }

  const slugTaken = await ctx.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, input.slug))
    .get();
  if (slugTaken) throw new ServiceError("CONFLICT", "Slug already in use");

  const tenantId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())"
    ).bind(orgId, input.name, input.slug),
    ctx.env.DB.prepare(
      "INSERT INTO tenants (id, slug, name, organization_id, parent_id, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())"
    ).bind(tenantId, input.slug, input.name, orgId, parent.id),
  ]);

  if (!input.actor.superAdmin && input.actor.user) {
    const memberId = crypto.randomUUID();
    await ctx.env.DB.prepare(
      "INSERT INTO member (id, userId, organizationId, role, createdAt) VALUES (?, ?, ?, ?, unixepoch())"
    ).bind(memberId, input.actor.user.id, orgId, ROLES.SUB_TENANT_OPERATOR).run();
  }

  await logAdminEvent(ctx.env.DB, "SUB_TENANT_CREATED", {
    detail: input.slug,
    actor: input.actor,
    tenantId,
    tenantParentId: parent.id,
  });

  return {
    id: tenantId,
    slug: input.slug,
    name: input.name,
    organization_id: orgId,
    parent_id: parent.id,
    deleted_at: null,
  };
}

/**
 * Update tenant `name` and/or `slug`. Syncs the linked organization row.
 * Throws `NOT_FOUND` for unknown / soft-deleted tenants, `VALIDATION` for
 * bad slug shape, `CONFLICT` when the new slug is taken.
 */
export async function updateTenant(
  ctx: ServiceCtx,
  input: { id: string; name?: string; slug?: string }
): Promise<{ id: string; slug: string; name: string }> {
  const tenant = await ctx.db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      organizationId: tenants.organizationId,
    })
    .from(tenants)
    .where(and(eq(tenants.id, input.id), isNull(tenants.deletedAt)))
    .get();
  if (!tenant) throw new ServiceError("NOT_FOUND", "Tenant not found");

  if (input.slug !== undefined && !SLUG_RE.test(input.slug)) {
    throw new ServiceError(
      "VALIDATION",
      "Slug must only contain lowercase letters, numbers, and dashes"
    );
  }

  if (input.slug && input.slug !== tenant.slug) {
    const conflict = await ctx.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.slug, input.slug), sql`${tenants.id} != ${input.id}`))
      .get();
    if (conflict) throw new ServiceError("CONFLICT", "Slug already in use");
  }

  const newName = input.name ?? tenant.name;
  const newSlug = input.slug ?? tenant.slug;

  await ctx.db
    .update(tenants)
    .set({ name: newName, slug: newSlug })
    .where(eq(tenants.id, input.id))
    .run();

  if (tenant.organizationId) {
    await ctx.db
      .update(organization)
      .set({ name: newName, slug: newSlug })
      .where(eq(organization.id, tenant.organizationId))
      .run();
  }

  return { id: input.id, slug: newSlug, name: newName };
}
/**
 * Soft-delete a tenant (sets `deleted_at`). Throws `NOT_FOUND` if tenant
 * is already deleted or does not exist.
 */
export async function softDeleteTenant(ctx: ServiceCtx, id: string): Promise<void> {
  const tenant = await ctx.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.id, id), isNull(tenants.deletedAt)))
    .get();
  if (!tenant) throw new ServiceError("NOT_FOUND", "Tenant not found");

  await ctx.db
    .update(tenants)
    .set({ deletedAt: sql`unixepoch()` as unknown as number })
    .where(eq(tenants.id, id))
    .run();
}

/**
 * Restore a soft-deleted tenant (clears `deleted_at`). Throws `NOT_FOUND`
 * when the tenant id does not exist.
 */
export async function restoreTenant(ctx: ServiceCtx, id: string): Promise<void> {
  const result = await ctx.db
    .update(tenants)
    .set({ deletedAt: null })
    .where(eq(tenants.id, id))
    .run();
  if (!result.meta || result.meta.changes === 0) {
    throw new ServiceError("NOT_FOUND", "Tenant not found");
  }
}