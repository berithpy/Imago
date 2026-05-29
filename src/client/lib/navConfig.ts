import type { AuthMembership, AuthState } from "./authContext";

/**
 * Role values are mirrored from the worker's `src/worker/lib/roles.ts`.
 * Kept in sync manually because the worker module imports server-only
 * bindings and can't be loaded in the SPA. If you change role identifiers
 * server-side, update them here too.
 */
export const ROLES = {
  IMAGO_OPERATOR: "imago_operator",
  TENANT_OPERATOR: "tenant_operator",
  SUB_TENANT_OPERATOR: "sub_tenant_operator",
  TENANT_COLLABORATOR: "tenant_collaborator",
} as const;

export type NavScope =
  | "platform"
  | "tenant-admin"
  | "tenant-public"
  | "gallery-viewer";

export type NavContext = {
  tenantSlug?: string;
  tenantName?: string;
  gallerySlug?: string;
};

export type NavItem = {
  /** Stable id for tests and React keys. */
  id: string;
  label: string;
  to: string;
  scope: NavScope;
};

// ------------------------------------------------------------------
// Internal: visibility predicates over the membership graph
// ------------------------------------------------------------------

function membershipFor(
  auth: AuthState | null,
  slug: string | undefined
): AuthMembership | undefined {
  if (!auth || !slug) return undefined;
  return auth.memberships.find((m) => m.tenantSlug === slug);
}

function tenantLabelFor(
  auth: AuthState | null,
  slug: string,
  tenantName: string | undefined
): string {
  if (tenantName) return tenantName;
  const m = membershipFor(auth, slug);
  return m?.tenantName || slug;
}

/** True when the actor can act as an admin on the given tenant. */
function canAdminTenant(auth: AuthState | null, slug: string | undefined): boolean {
  if (!auth || !slug) return false;
  if (auth.superAdmin) return true;
  return !!membershipFor(auth, slug);
}

/** True for tenant_operator (own or parent-of-sub) and Imago operator. */
function canManageMembers(auth: AuthState | null, slug: string | undefined): boolean {
  if (!auth || !slug) return false;
  if (auth.superAdmin) return true;
  const m = membershipFor(auth, slug);
  if (!m) return false;
  return m.role === ROLES.TENANT_OPERATOR || m.role === ROLES.SUB_TENANT_OPERATOR;
}

/** True for top-level tenant_operator (no parent) and Imago operator. */
function canManageBilling(auth: AuthState | null, slug: string | undefined): boolean {
  if (!auth || !slug) return false;
  if (auth.superAdmin) return true;
  const m = membershipFor(auth, slug);
  return m?.role === ROLES.TENANT_OPERATOR && m.parentTenantSlug === null;
}

/** Subscribers + usage are visible to operators (top-level + sub) and Imago. */
function canViewTenantOps(auth: AuthState | null, slug: string | undefined): boolean {
  if (!auth || !slug) return false;
  if (auth.superAdmin) return true;
  const m = membershipFor(auth, slug);
  if (!m) return false;
  return (
    m.role === ROLES.TENANT_OPERATOR || m.role === ROLES.SUB_TENANT_OPERATOR
  );
}

// ------------------------------------------------------------------
// Public: buildNav
// ------------------------------------------------------------------

/**
 * Returns the ordered set of nav items appropriate for the current actor
 * and URL context. Items are pre-filtered by visibility — the caller can
 * render them directly without further role checks.
 *
 * Scope precedence:
 *   - gallery-viewer (when ctx.gallerySlug is set)
 *   - tenant-admin   (when ctx.tenantSlug is set and actor has access)
 *   - tenant-public  (when ctx.tenantSlug is set, public access)
 *   - platform       (when actor is Imago operator and no tenant context)
 *
 * Multiple scopes can apply at once; the result is the concatenation of
 * all items whose visibility predicate is true, in the order defined here.
 */
export function buildNav(
  auth: AuthState | null,
  ctx: NavContext = {}
): NavItem[] {
  const items: NavItem[] = [];
  const t = ctx.tenantSlug;
  const g = ctx.gallerySlug;

  // -- platform scope -------------------------------------------------
  if (!t && !g && auth?.superAdmin) {
    items.push(
      {
        id: "platform-tenants",
        label: "Tenants",
        to: "/operator/tenants",
        scope: "platform",
      },
      {
        id: "platform-users",
        label: "Users",
        to: "/operator/users",
        scope: "platform",
      }
    );
  }

  // -- tenant-admin scope ----------------------------------------------
  if (t && canAdminTenant(auth, t)) {
    items.push({
      id: "tenant-galleries",
      label: tenantLabelFor(auth, t, ctx.tenantName),
      to: `/${t}/manage`,
      scope: "tenant-admin",
    });
  }

  // -- tenant-public scope ---------------------------------------------
  // Visible to anyone browsing a tenant URL who isn't already in the
  // admin scope. Provides a way back to the public gallery index.
  if (t && !canAdminTenant(auth, t) && !g) {
    items.push({
      id: "tenant-public-galleries",
      label: "Galleries",
      to: `/${t}`,
      scope: "tenant-public",
    });
  }

  // -- gallery-viewer scope --------------------------------------------
  if (t && g) {
    items.push({
      id: "gallery-photos",
      label: "Photos",
      to: `/${t}/${g}`,
      scope: "gallery-viewer",
    });
    if (canAdminTenant(auth, t)) {
      items.push({
        id: "gallery-manage",
        label: "Manage gallery",
        to: `/${t}/${g}/edit`,
        scope: "gallery-viewer",
      });
    }
  }

  return items;
}

/**
 * Tenant-scoped admin destinations that are intentionally hidden from
 * the primary nav and rendered from the cog/settings menu instead.
 */
export function buildTenantSettingsNav(
  auth: AuthState | null,
  ctx: NavContext = {}
): NavItem[] {
  const items: NavItem[] = [];
  const t = ctx.tenantSlug;
  if (!t || !canAdminTenant(auth, t)) return items;

  if (canManageMembers(auth, t)) {
    items.push({
      id: "tenant-members",
      label: "Members",
      to: `/${t}/manage/members`,
      scope: "tenant-admin",
    });
  }

  if (canViewTenantOps(auth, t)) {
    items.push({
      id: "tenant-subscribers",
      label: "Subscribers",
      to: `/${t}/manage/subscribers`,
      scope: "tenant-admin",
    });
    items.push({
      id: "tenant-usage",
      label: "Usage",
      to: `/${t}/manage/usage`,
      scope: "tenant-admin",
    });
  }

  if (canManageMembers(auth, t)) {
    items.push({
      id: "tenant-settings",
      label: "Settings",
      to: `/${t}/manage/settings`,
      scope: "tenant-admin",
    });
  }

  if (canManageBilling(auth, t)) {
    items.push({
      id: "tenant-billing",
      label: "Billing",
      to: `/${t}/manage/billing`,
      scope: "tenant-admin",
    });
  }

  return items;
}

/** Platform-level destinations shown from the settings cog for operators. */
export function buildOperatorSettingsNav(auth: AuthState | null): NavItem[] {
  if (!auth?.superAdmin) return [];
  return [];
}

export function isNavItemActive(currentPath: string, item: NavItem): boolean {
  if (item.to === "/") return currentPath === "/";
  if (item.id === "gallery-photos") {
    if (currentPath === item.to) return true;
    if (!currentPath.startsWith(`${item.to}/`)) return false;
    const subPath = currentPath.slice(item.to.length + 1);
    return !subPath.startsWith("edit") && !subPath.startsWith("login");
  }
  return currentPath === item.to || currentPath.startsWith(`${item.to}/`);
}
