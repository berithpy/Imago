import { describe, expect, it } from "vitest";
import {
  buildNav,
  buildOperatorSettingsNav,
  buildTenantSettingsNav,
  isNavItemActive,
  ROLES,
  type NavContext,
  type NavItem,
} from "../lib/navConfig";
import type { AuthMembership, AuthState } from "../lib/authContext";

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

function makeAuth(opts: {
  superAdmin?: boolean;
  memberships?: AuthMembership[];
}): AuthState {
  return {
    user: { id: "u1", email: "user@example.com", name: "User" },
    superAdmin: opts.superAdmin ?? false,
    memberships: opts.memberships ?? [],
  };
}

function membership(
  slug: string,
  role: string,
  parentTenantSlug: string | null = null
): AuthMembership {
  return {
    tenantId: `id-${slug}`,
    tenantSlug: slug,
    tenantName: slug,
    role,
    roleDisplay: role,
    parentTenantSlug,
  };
}

const ANON: AuthState | null = null;

const IMAGO_OP = makeAuth({ superAdmin: true });

const TENANT_OP_ACME = makeAuth({
  memberships: [membership("acme", ROLES.TENANT_OPERATOR)],
});

const SUB_TENANT_OP_ACME_EU = makeAuth({
  memberships: [membership("acme-eu", ROLES.SUB_TENANT_OPERATOR, "acme")],
});

const COLLAB_ACME = makeAuth({
  memberships: [membership("acme", ROLES.TENANT_COLLABORATOR)],
});

// Helper: extract just the ids in order — that's what we assert on.
function ids(items: NavItem[]): string[] {
  return items.map((i) => i.id);
}

// ------------------------------------------------------------------
// Table-driven cases
// ------------------------------------------------------------------

type Case = {
  name: string;
  auth: AuthState | null;
  ctx: NavContext;
  expected: string[];
};

const cases: Case[] = [
  // --- platform scope ---
  {
    name: "anon @ platform — no items",
    auth: ANON,
    ctx: {},
    expected: [],
  },
  {
    name: "imago_operator @ platform — primary nav stays empty",
    auth: IMAGO_OP,
    ctx: {},
    expected: [],
  },
  {
    name: "tenant_operator @ platform (no tenant ctx) — no items",
    auth: TENANT_OP_ACME,
    ctx: {},
    expected: [],
  },

  // --- tenant-admin scope ---
  {
    name: "imago_operator @ tenant — tenant entry only",
    auth: IMAGO_OP,
    ctx: { tenantSlug: "acme" },
    expected: ["tenant-galleries"],
  },
  {
    name: "tenant_operator @ own tenant — tenant entry only",
    auth: TENANT_OP_ACME,
    ctx: { tenantSlug: "acme" },
    expected: ["tenant-galleries"],
  },
  {
    name: "sub_tenant_operator @ own sub-tenant — tenant entry only",
    auth: SUB_TENANT_OP_ACME_EU,
    ctx: { tenantSlug: "acme-eu" },
    expected: ["tenant-galleries"],
  },
  {
    name: "tenant_collaborator @ own tenant — galleries only",
    auth: COLLAB_ACME,
    ctx: { tenantSlug: "acme" },
    expected: ["tenant-galleries"],
  },
  {
    name: "tenant_operator @ unrelated tenant — public fallback",
    auth: TENANT_OP_ACME,
    ctx: { tenantSlug: "other" },
    expected: ["tenant-public-galleries"],
  },

  // --- tenant-public scope ---
  {
    name: "anon @ tenant — public galleries link",
    auth: ANON,
    ctx: { tenantSlug: "acme" },
    expected: ["tenant-public-galleries"],
  },

  // --- gallery-viewer scope ---
  {
    name: "anon @ gallery — photos only",
    auth: ANON,
    ctx: { tenantSlug: "acme", gallerySlug: "summer" },
    expected: ["gallery-photos"],
  },
  {
    name: "tenant_operator @ own gallery — tenant + photos + manage",
    auth: TENANT_OP_ACME,
    ctx: { tenantSlug: "acme", gallerySlug: "summer" },
    expected: [
      "tenant-galleries",
      "gallery-photos",
      "gallery-manage",
    ],
  },
  {
    name: "imago_operator @ any gallery — tenant + photos + manage",
    auth: IMAGO_OP,
    ctx: { tenantSlug: "acme", gallerySlug: "summer" },
    expected: [
      "tenant-galleries",
      "gallery-photos",
      "gallery-manage",
    ],
  },
];

describe("buildNav — visibility matrix", () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(ids(buildNav(c.auth, c.ctx))).toEqual(c.expected);
    });
  }
});

describe("buildNav — URL construction", () => {
  it("uses the tenantSlug from ctx in admin URLs", () => {
    const items = buildTenantSettingsNav(TENANT_OP_ACME, { tenantSlug: "acme" });
    const settings = items.find((i) => i.id === "tenant-settings");
    expect(settings?.to).toBe("/acme/manage/settings");
  });

  it("uses the gallerySlug from ctx in viewer URLs", () => {
    const items = buildNav(ANON, {
      tenantSlug: "acme",
      gallerySlug: "summer-2024",
    });
    const photos = items.find((i) => i.id === "gallery-photos");
    expect(photos?.to).toBe("/acme/summer-2024");
  });

  it("manage gallery link points to the editor", () => {
    const items = buildNav(TENANT_OP_ACME, {
      tenantSlug: "acme",
      gallerySlug: "summer",
    });
    const manage = items.find((i) => i.id === "gallery-manage");
    expect(manage?.to).toBe("/acme/summer/edit");
  });
});

describe("buildNav — labels", () => {
  it("labels the tenant entry with the tenant name when available", () => {
    const auth = makeAuth({
      memberships: [
        {
          ...membership("acme", ROLES.TENANT_OPERATOR),
          tenantName: "Acme Studio",
        },
      ],
    });
    const items = buildNav(auth, { tenantSlug: "acme" });
    expect(items.find((i) => i.id === "tenant-galleries")?.label).toBe("Acme Studio");
  });

  it("falls back to the tenant slug when no membership name is available", () => {
    const items = buildNav(IMAGO_OP, { tenantSlug: "acme" });
    expect(items.find((i) => i.id === "tenant-galleries")?.label).toBe("acme");
  });

  it("labels operator tenant entries with tenant metadata when available", () => {
    const items = buildNav(IMAGO_OP, {
      tenantSlug: "acme",
      tenantName: "Acme Studio",
    });
    expect(items.find((i) => i.id === "tenant-galleries")?.label).toBe("Acme Studio");
  });
});

describe("buildTenantSettingsNav", () => {
  it("keeps tenant admin actions in the settings menu for tenant operators", () => {
    const items = buildTenantSettingsNav(TENANT_OP_ACME, { tenantSlug: "acme" });
    expect(ids(items)).toEqual([
      "tenant-members",
      "tenant-subscribers",
      "tenant-usage",
      "tenant-settings",
      "tenant-billing",
    ]);
  });

  it("keeps collaborator-only access limited to the tenant entry", () => {
    const items = buildTenantSettingsNav(COLLAB_ACME, { tenantSlug: "acme" });
    expect(ids(items)).toEqual([]);
  });
});

describe("buildOperatorSettingsNav", () => {
  it("puts the operator dashboard in the settings menu for imago operators", () => {
    expect(ids(buildOperatorSettingsNav(IMAGO_OP))).toEqual(["platform-operator"]);
    expect(buildOperatorSettingsNav(IMAGO_OP)[0]?.to).toBe("/operator");
  });

  it("does not expose operator settings links for regular tenant users", () => {
    expect(buildOperatorSettingsNav(TENANT_OP_ACME)).toEqual([]);
  });
});

describe("isNavItemActive", () => {
  const photos: NavItem = {
    id: "gallery-photos",
    label: "Photos",
    to: "/acme/summer",
    scope: "gallery-viewer",
  };
  const manage: NavItem = {
    id: "gallery-manage",
    label: "Manage gallery",
    to: "/acme/summer/edit",
    scope: "gallery-viewer",
  };

  it("marks Photos active only on the viewer URL", () => {
    expect(isNavItemActive("/acme/summer", photos)).toBe(true);
    expect(isNavItemActive("/acme/summer/photo-123", photos)).toBe(true);
    expect(isNavItemActive("/acme/summer/edit", photos)).toBe(false);
  });

  it("marks Manage gallery active on the editor URL", () => {
    expect(isNavItemActive("/acme/summer/edit", manage)).toBe(true);
  });
});

describe("buildNav — scope tagging", () => {
  it("tags every item with a scope", () => {
    const ctx = { tenantSlug: "acme", gallerySlug: "summer" };
    const items = [
      ...buildNav(IMAGO_OP, ctx),
      ...buildTenantSettingsNav(IMAGO_OP, ctx),
      ...buildOperatorSettingsNav(IMAGO_OP),
    ];
    for (const item of items) {
      expect(item.scope).toBeDefined();
    }
  });
});
