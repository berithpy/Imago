import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

const { mockGetSession, mockSignUpEmail } = vi.hoisted(() => ({
  mockGetSession: vi.fn<() => Promise<{ user: { email: string; id?: string } } | null>>(
    async () => ({ user: { email: "superadmin@example.com", id: "super-id" } })
  ),
  mockSignUpEmail: vi.fn(async ({ body }: { body: { email: string; name: string } }) => ({
    user: { id: crypto.randomUUID(), email: body.email, name: body.name },
  })),
}));

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      getSession: mockGetSession,
      signUpEmail: mockSignUpEmail,
    },
  })),
}));

let harness: WorkerTestHarness;

describe("tenants routes", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue({ user: { email: "superadmin@example.com", id: "super-id" } });
    mockSignUpEmail.mockClear();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  // ------------------------------------------------------------------
  // Auth guards
  // ------------------------------------------------------------------

  it("GET /api/operator/tenants returns 401 without session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await harness.request("/api/operator/tenants");
    expect(res.status).toBe(401);
  });

  it("GET /api/operator/tenants returns 403 when user is not super-admin", async () => {
    // A real super-admin already exists, plus a separate non-super-admin user
    // who is the one logging in. That second user must remain forbidden.
    await harness.seedUser({ email: "real-super@example.com", isSuperAdmin: true });
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: false });
    const res = await harness.request("/api/operator/tenants");
    expect(res.status).toBe(403);
  });

  it("GET /api/operator/tenants returns 200 for super-admin", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request("/api/operator/tenants");
    expect(res.status).toBe(200);
    const body = await res.json() as { tenants: unknown[] };
    expect(Array.isArray(body.tenants)).toBe(true);
  });

  it("GET /api/operator/tenants supports q + page + pageSize", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    await harness.seedTenant("acme-weddings", "Acme Weddings");
    await harness.seedTenant("acme-studio", "Acme Studio");
    await harness.seedTenant("other-family", "Other Family");

    const res = await harness.request("/api/operator/tenants?q=acme&page=1&pageSize=1");
    expect(res.status).toBe(200);

    const body = await res.json() as {
      tenants: Array<{ slug: string }>;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };

    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(body.tenants.length).toBe(1);
    expect(body.tenants[0]?.slug).toContain("acme");
  });

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  it("POST /api/operator/tenants creates a tenant and returns 201", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request("/api/operator/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "acme-corp", name: "Acme Corp" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { tenant: { slug: string; name: string } };
    expect(body.tenant.slug).toBe("acme-corp");
    expect(body.tenant.name).toBe("Acme Corp");
  });

  it("POST /api/operator/tenants returns 400 for invalid slug format", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request("/api/operator/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "Bad Slug!", name: "Test" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/slug/i);
  });

  it("POST /api/operator/tenants returns 409 for duplicate slug", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    await harness.seedTenant("duplicate-slug");
    const res = await harness.request("/api/operator/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "duplicate-slug", name: "Another" }),
    });
    expect(res.status).toBe(409);
  });

  it("PATCH /api/operator/tenants/:id updates name", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("patch-me", "Original Name");
    const res = await harness.request(`/api/operator/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { tenant: { name: string } };
    expect(body.tenant.name).toBe("Updated Name");
  });

  it("DELETE /api/operator/tenants/:id soft-deletes the tenant", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("to-delete");

    const delRes = await harness.request(`/api/operator/tenants/${tenant.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT deleted_at FROM tenants WHERE id = ?"
    ).bind(tenant.id).first<{ deleted_at: number | null }>();
    expect(row?.deleted_at).not.toBeNull();
  });

  it("POST /api/operator/tenants/:id/restore clears deleted_at", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("to-restore");
    await harness.runSql("UPDATE tenants SET deleted_at = unixepoch() WHERE id = ?", [tenant.id]);

    const res = await harness.request(`/api/operator/tenants/${tenant.id}/restore`, { method: "POST" });
    expect(res.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT deleted_at FROM tenants WHERE id = ?"
    ).bind(tenant.id).first<{ deleted_at: number | null }>();
    expect(row?.deleted_at).toBeNull();
  });

  // ------------------------------------------------------------------
  // check-slug
  // ------------------------------------------------------------------

  it("GET /api/operator/tenants/check-slug returns available=true for free slug", async () => {
    const res = await harness.request("/api/operator/tenants/check-slug?slug=new-tenant");
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean; valid: boolean };
    expect(body.available).toBe(true);
    expect(body.valid).toBe(true);
  });

  it("GET /api/operator/tenants/check-slug returns available=false for taken slug", async () => {
    await harness.seedTenant("taken-slug");
    const res = await harness.request("/api/operator/tenants/check-slug?slug=taken-slug");
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(false);
  });

  it("GET /api/operator/tenants/check-slug returns valid=false for invalid format", async () => {
    const res = await harness.request("/api/operator/tenants/check-slug?slug=Bad+Slug");
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  // ------------------------------------------------------------------
  // Users endpoint
  // ------------------------------------------------------------------

  it("GET /api/tenant/users returns 403 for non-super-admin", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: false });
    const res = await harness.request("/api/tenant/users");
    expect(res.status).toBe(403);
  });

  it("GET /api/tenant/users returns all users for super-admin", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    await harness.seedUser({ email: "member@example.com" });
    const res = await harness.request("/api/tenant/users");
    expect(res.status).toBe(200);
    const body = await res.json() as { users: Array<{ email: string }> };
    const emails = body.users.map((u) => u.email);
    expect(emails).toContain("superadmin@example.com");
    expect(emails).toContain("member@example.com");
  });

  it("GET /api/tenant/users?tenantId= filters by tenant via member table", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenantUser = await harness.seedUser({ email: "tenant-member@example.com" });
    const otherUser = await harness.seedUser({ email: "other@example.com" });

    // Create an org and link it to a tenant
    const orgId = crypto.randomUUID();
    const tenant = await harness.seedTenant("filter-tenant");
    await harness.runSql(
      "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())",
      [orgId, "Filter Tenant", "filter-tenant"]
    );
    await harness.runSql(
      "UPDATE tenants SET organization_id = ? WHERE id = ?",
      [orgId, tenant.id]
    );
    await harness.runSql(
      "INSERT INTO member (id, userId, organizationId, role, createdAt) VALUES (?, ?, ?, 'member', unixepoch())",
      [crypto.randomUUID(), tenantUser.id, orgId]
    );

    const res = await harness.request(`/api/tenant/users?tenantId=${tenant.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { users: Array<{ email: string }> };
    const emails = body.users.map((u) => u.email);
    expect(emails).toContain("tenant-member@example.com");
    expect(emails).not.toContain("other@example.com");
  });

  it("GET /api/tenant/users supports q + page + pageSize + superAdminOnly", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    await harness.seedUser({ email: "operator.alpha@example.com", isSuperAdmin: true });
    await harness.seedUser({ email: "operator.beta@example.com", isSuperAdmin: true });
    await harness.seedUser({ email: "member@example.com", isSuperAdmin: false });

    const res = await harness.request(
      "/api/tenant/users?q=operator&page=1&pageSize=1&superAdminOnly=1"
    );
    expect(res.status).toBe(200);

    const body = await res.json() as {
      users: Array<{ email: string; is_super_admin: number }>;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };

    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(body.users.length).toBe(1);
    expect(body.users[0]?.email).toContain("operator");
    expect(body.users[0]?.is_super_admin).toBe(1);
  });

  // ------------------------------------------------------------------
  // PATCH edge cases
  // ------------------------------------------------------------------

  it("PATCH /api/operator/tenants/:id returns 404 for non-existent tenant", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request(`/api/operator/tenants/${crypto.randomUUID()}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ghost Name" }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/operator/tenants/:id returns 400 for invalid slug format", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("valid-slug");
    const res = await harness.request(`/api/operator/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "Invalid Slug!" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("Slug") });
  });

  it("PATCH /api/operator/tenants/:id returns 409 for duplicate slug", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    await harness.seedTenant("already-taken");
    const tenant = await harness.seedTenant("mine");
    const res = await harness.request(`/api/operator/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "already-taken" }),
    });
    expect(res.status).toBe(409);
  });

  it("PATCH /api/operator/tenants/:id syncs linked organization slug and name", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    // Create a tenant with an org via the API so organization_id is set
    const createRes = await harness.request("/api/operator/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "sync-me", name: "Before" }),
    });
    expect(createRes.status).toBe(201);
    const { tenant } = await createRes.json() as { tenant: { id: string; organization_id: string } };

    const patchRes = await harness.request(`/api/operator/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "After", slug: "sync-me-updated" }),
    });
    expect(patchRes.status).toBe(200);

    const org = await harness.env.DB.prepare(
      "SELECT name, slug FROM organization WHERE id = ?"
    ).bind(tenant.organization_id).first<{ name: string; slug: string }>();
    expect(org?.name).toBe("After");
    expect(org?.slug).toBe("sync-me-updated");
  });

  // ------------------------------------------------------------------
  // DELETE / restore edge cases
  // ------------------------------------------------------------------

  it("DELETE /api/operator/tenants/:id returns 404 for already-deleted tenant", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("gone-already");
    await harness.runSql("UPDATE tenants SET deleted_at = unixepoch() WHERE id = ?", [tenant.id]);
    const res = await harness.request(`/api/operator/tenants/${tenant.id}`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("POST /api/operator/tenants/:id/restore returns 404 for non-existent tenant", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request(`/api/operator/tenants/${crypto.randomUUID()}/restore`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/operator/tenants rejects reserved slugs", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    for (const slug of ["login", "operator", "gallery", "api"]) {
      const res = await harness.request("/api/operator/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, name: "Reserved" }),
      });
      expect(res.status, `slug=${slug}`).toBe(400);
      expect(await res.json()).toEqual({ error: "Slug is reserved" });
    }
  });

  it("GET /api/operator/tenants/check-slug flags reserved slugs", async () => {
    const res = await harness.request("/api/operator/tenants/check-slug?slug=login");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, available: false, reserved: true });
  });

  // ------------------------------------------------------------------
  // Sub-tenants — POST /api/operator/tenants/sub-tenants
  // ------------------------------------------------------------------

  async function seedTenantWithOrg(slug: string, parentId: string | null = null) {
    const tenantId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())",
      [orgId, slug, slug]
    );
    await harness.runSql(
      "INSERT INTO tenants (id, slug, name, organization_id, parent_id, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())",
      [tenantId, slug, slug, orgId, parentId]
    );
    return { tenantId, orgId };
  }

  it("POST /sub-tenants returns 401 when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const parent = await seedTenantWithOrg("p1");
    const res = await harness.request("/api/operator/tenants/sub-tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: parent.tenantId, slug: "p1-sub", name: "Sub" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /sub-tenants creates a child for super-admin", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const parent = await seedTenantWithOrg("acme");
    const res = await harness.request("/api/operator/tenants/sub-tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: parent.tenantId, slug: "acme-weddings", name: "Weddings" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { tenant: { slug: string; parent_id: string } };
    expect(body.tenant.slug).toBe("acme-weddings");
    expect(body.tenant.parent_id).toBe(parent.tenantId);
  });

  it("POST /sub-tenants creates a child for the parent's tenant_operator", async () => {
    const owner = await harness.seedUser({ email: "owner@example.com" });
    const parent = await seedTenantWithOrg("studio");
    await harness.runSql(
      "INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, 'tenant_operator', unixepoch())",
      [crypto.randomUUID(), parent.orgId, owner.id]
    );
    mockGetSession.mockResolvedValue({ user: { email: owner.email, id: owner.id } });

    const res = await harness.request("/api/operator/tenants/sub-tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: parent.tenantId, slug: "studio-events", name: "Events" }),
    });
    expect(res.status).toBe(201);

    // Owner should automatically become sub_tenant_operator on the new sub
    const sub = await harness.env.DB.prepare(
      "SELECT id, organization_id FROM tenants WHERE slug = ?"
    ).bind("studio-events").first<{ id: string; organization_id: string }>();
    const m = await harness.env.DB.prepare(
      "SELECT role FROM member WHERE userId = ? AND organizationId = ?"
    ).bind(owner.id, sub!.organization_id).first<{ role: string }>();
    expect(m?.role).toBe("sub_tenant_operator");
  });

  it("POST /sub-tenants returns 403 for sub-tenant operator (depth-1 enforcement: cannot create grandchild)", async () => {
    const lead = await harness.seedUser({ email: "lead@example.com" });
    const parent = await seedTenantWithOrg("topp");
    const sub = await seedTenantWithOrg("topp-sub", parent.tenantId);
    await harness.runSql(
      "INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, 'sub_tenant_operator', unixepoch())",
      [crypto.randomUUID(), sub.orgId, lead.id]
    );
    mockGetSession.mockResolvedValue({ user: { email: lead.email, id: lead.id } });

    const res = await harness.request("/api/operator/tenants/sub-tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: sub.tenantId, slug: "topp-sub-deep", name: "Too Deep" }),
    });
    // Depth check fires before the role check, so this returns 400 even
    // when the actor would otherwise have permission.
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("sub-tenants") });
  });

  it("POST /sub-tenants returns 403 for collaborator on parent", async () => {
    const collab = await harness.seedUser({ email: "collab@example.com" });
    const parent = await seedTenantWithOrg("collab-parent");
    await harness.runSql(
      "INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, 'tenant_collaborator', unixepoch())",
      [crypto.randomUUID(), parent.orgId, collab.id]
    );
    mockGetSession.mockResolvedValue({ user: { email: collab.email, id: collab.id } });

    const res = await harness.request("/api/operator/tenants/sub-tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: parent.tenantId, slug: "should-not", name: "Nope" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /sub-tenants returns 404 for missing parent", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request("/api/operator/tenants/sub-tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: crypto.randomUUID(), slug: "ghost-sub", name: "Ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /sub-tenants writes admin_log row with parent_operator actor_type and visibility to sub", async () => {
    const owner = await harness.seedUser({ email: "owner2@example.com" });
    const parent = await seedTenantWithOrg("logme");
    await harness.runSql(
      "INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, 'tenant_operator', unixepoch())",
      [crypto.randomUUID(), parent.orgId, owner.id]
    );
    mockGetSession.mockResolvedValue({ user: { email: owner.email, id: owner.id } });

    await harness.request("/api/operator/tenants/sub-tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId: parent.tenantId, slug: "logme-sub", name: "Sub" }),
    });

    const newSub = await harness.env.DB.prepare(
      "SELECT id FROM tenants WHERE slug = ?"
    ).bind("logme-sub").first<{ id: string }>();

    const log = await harness.env.DB.prepare(
      "SELECT actor_type, actor_user_id, tenant_id, visible_to_tenant_id FROM admin_log WHERE event = 'SUB_TENANT_CREATED'"
    ).first<{
      actor_type: string;
      actor_user_id: string;
      tenant_id: string;
      visible_to_tenant_id: string;
    }>();
    expect(log).not.toBeNull();
    expect(log?.actor_type).toBe("parent_operator");
    expect(log?.actor_user_id).toBe(owner.id);
    expect(log?.tenant_id).toBe(newSub?.id);
    expect(log?.visible_to_tenant_id).toBe(newSub?.id);
  });
});
