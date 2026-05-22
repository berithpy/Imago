import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";
import { ROLES } from "../../lib/roles";

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn<
    () => Promise<{ user: { email: string; id?: string; name?: string } } | null>
  >(async () => null),
}));

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      getSession: mockGetSession,
      signUpEmail: vi.fn(async () => ({ ok: true })),
      signInMagicLink: vi.fn(async () => ({ ok: true })),
    },
  })),
}));

let harness: WorkerTestHarness;

async function seedTenantOrg(slug: string, name = slug, parentId: string | null = null) {
  const tenantId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await harness.runSql(
    "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())",
    [orgId, name, slug]
  );
  await harness.runSql(
    "INSERT INTO tenants (id, slug, name, organization_id, parent_id, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())",
    [tenantId, slug, name, orgId, parentId]
  );
  return { tenantId, orgId };
}

async function addMember(userId: string, orgId: string, role: string) {
  await harness.runSql(
    "INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, ?, unixepoch())",
    [crypto.randomUUID(), orgId, userId, role]
  );
}

describe("GET /api/me", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(null);
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("returns 401 when no session", async () => {
    const res = await harness.request("/api/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 when session exists but user row is missing", async () => {
    mockGetSession.mockResolvedValue({ user: { email: "ghost@example.com" } });
    const res = await harness.request("/api/me");
    expect(res.status).toBe(401);
  });

  it("returns superAdmin=true and empty memberships for an Imago operator", async () => {
    const user = await harness.seedUser({ email: "super@example.com", isSuperAdmin: true });
    mockGetSession.mockResolvedValue({ user: { email: user.email, id: user.id } });
    const res = await harness.request("/api/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { email: string };
      superAdmin: boolean;
      memberships: unknown[];
    };
    expect(body.superAdmin).toBe(true);
    expect(body.user.email).toBe("super@example.com");
    expect(body.memberships).toEqual([]);
  });

  it("returns memberships with parent slug for a sub-tenant operator", async () => {
    const user = await harness.seedUser({ email: "lead@example.com" });
    const parent = await seedTenantOrg("studio-acme", "Acme");
    const child = await seedTenantOrg("studio-acme-weddings", "Acme Weddings", parent.tenantId);
    await addMember(user.id, parent.orgId, ROLES.TENANT_OPERATOR);
    await addMember(user.id, child.orgId, ROLES.SUB_TENANT_OPERATOR);

    mockGetSession.mockResolvedValue({ user: { email: user.email, id: user.id } });
    const res = await harness.request("/api/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      superAdmin: boolean;
      memberships: Array<{
        tenantSlug: string;
        role: string;
        roleDisplay: string;
        parentTenantSlug: string | null;
      }>;
    };
    expect(body.superAdmin).toBe(false);

    const slugs = body.memberships.map((m) => m.tenantSlug).sort();
    expect(slugs).toEqual(["studio-acme", "studio-acme-weddings"]);

    const sub = body.memberships.find((m) => m.tenantSlug === "studio-acme-weddings")!;
    expect(sub.role).toBe(ROLES.SUB_TENANT_OPERATOR);
    expect(sub.parentTenantSlug).toBe("studio-acme");
    expect(sub.roleDisplay).toBe("Workspace lead");
  });

  it("coerces legacy 'member' role to tenant_operator for backwards compat", async () => {
    const user = await harness.seedUser({ email: "legacy@example.com" });
    const t = await seedTenantOrg("legacy-tenant");
    await addMember(user.id, t.orgId, "member");

    mockGetSession.mockResolvedValue({ user: { email: user.email, id: user.id } });
    const res = await harness.request("/api/me");
    const body = (await res.json()) as { memberships: Array<{ role: string }> };
    expect(body.memberships[0].role).toBe(ROLES.TENANT_OPERATOR);
  });
});
