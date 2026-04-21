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

  it("GET /api/admin/tenants returns 401 without session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await harness.request("/api/admin/tenants");
    expect(res.status).toBe(401);
  });

  it("GET /api/admin/tenants returns 403 when user is not super-admin", async () => {
    // User exists but is not super-admin
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: false });
    const res = await harness.request("/api/admin/tenants");
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/tenants returns 200 for super-admin", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request("/api/admin/tenants");
    expect(res.status).toBe(200);
    const body = await res.json() as { tenants: unknown[] };
    expect(Array.isArray(body.tenants)).toBe(true);
  });

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  it("POST /api/admin/tenants creates a tenant and returns 201", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "acme-corp", name: "Acme Corp" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { tenant: { slug: string; name: string } };
    expect(body.tenant.slug).toBe("acme-corp");
    expect(body.tenant.name).toBe("Acme Corp");
  });

  it("POST /api/admin/tenants returns 400 for invalid slug format", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "Bad Slug!", name: "Test" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/slug/i);
  });

  it("POST /api/admin/tenants returns 409 for duplicate slug", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    await harness.seedTenant("duplicate-slug");
    const res = await harness.request("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "duplicate-slug", name: "Another" }),
    });
    expect(res.status).toBe(409);
  });

  it("PATCH /api/admin/tenants/:id updates name", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("patch-me", "Original Name");
    const res = await harness.request(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { tenant: { name: string } };
    expect(body.tenant.name).toBe("Updated Name");
  });

  it("DELETE /api/admin/tenants/:id soft-deletes the tenant", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("to-delete");

    const delRes = await harness.request(`/api/admin/tenants/${tenant.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT deleted_at FROM tenants WHERE id = ?"
    ).bind(tenant.id).first<{ deleted_at: number | null }>();
    expect(row?.deleted_at).not.toBeNull();
  });

  it("POST /api/admin/tenants/:id/restore clears deleted_at", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("to-restore");
    await harness.runSql("UPDATE tenants SET deleted_at = unixepoch() WHERE id = ?", [tenant.id]);

    const res = await harness.request(`/api/admin/tenants/${tenant.id}/restore`, { method: "POST" });
    expect(res.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT deleted_at FROM tenants WHERE id = ?"
    ).bind(tenant.id).first<{ deleted_at: number | null }>();
    expect(row?.deleted_at).toBeNull();
  });

  // ------------------------------------------------------------------
  // check-slug
  // ------------------------------------------------------------------

  it("GET /api/admin/tenants/check-slug returns available=true for free slug", async () => {
    const res = await harness.request("/api/admin/tenants/check-slug?slug=new-tenant");
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean; valid: boolean };
    expect(body.available).toBe(true);
    expect(body.valid).toBe(true);
  });

  it("GET /api/admin/tenants/check-slug returns available=false for taken slug", async () => {
    await harness.seedTenant("taken-slug");
    const res = await harness.request("/api/admin/tenants/check-slug?slug=taken-slug");
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(false);
  });

  it("GET /api/admin/tenants/check-slug returns valid=false for invalid format", async () => {
    const res = await harness.request("/api/admin/tenants/check-slug?slug=Bad+Slug");
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean };
    expect(body.valid).toBe(false);
  });

  // ------------------------------------------------------------------
  // Users endpoint
  // ------------------------------------------------------------------

  it("GET /api/admin/users returns 403 for non-super-admin", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: false });
    const res = await harness.request("/api/admin/users");
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/users returns all users for super-admin", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    await harness.seedUser({ email: "member@example.com" });
    const res = await harness.request("/api/admin/users");
    expect(res.status).toBe(200);
    const body = await res.json() as { users: Array<{ email: string }> };
    const emails = body.users.map((u) => u.email);
    expect(emails).toContain("superadmin@example.com");
    expect(emails).toContain("member@example.com");
  });

  it("GET /api/admin/users?tenantId= filters by tenant via member table", async () => {
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

    const res = await harness.request(`/api/admin/users?tenantId=${tenant.id}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { users: Array<{ email: string }> };
    const emails = body.users.map((u) => u.email);
    expect(emails).toContain("tenant-member@example.com");
    expect(emails).not.toContain("other@example.com");
  });

  // ------------------------------------------------------------------
  // PATCH edge cases
  // ------------------------------------------------------------------

  it("PATCH /api/admin/tenants/:id returns 404 for non-existent tenant", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request(`/api/admin/tenants/${crypto.randomUUID()}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ghost Name" }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/admin/tenants/:id returns 400 for invalid slug format", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("valid-slug");
    const res = await harness.request(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "Invalid Slug!" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("Slug") });
  });

  it("PATCH /api/admin/tenants/:id returns 409 for duplicate slug", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    await harness.seedTenant("already-taken");
    const tenant = await harness.seedTenant("mine");
    const res = await harness.request(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "already-taken" }),
    });
    expect(res.status).toBe(409);
  });

  it("PATCH /api/admin/tenants/:id syncs linked organization slug and name", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    // Create a tenant with an org via the API so organization_id is set
    const createRes = await harness.request("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "sync-me", name: "Before" }),
    });
    expect(createRes.status).toBe(201);
    const { tenant } = await createRes.json() as { tenant: { id: string; organization_id: string } };

    const patchRes = await harness.request(`/api/admin/tenants/${tenant.id}`, {
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

  it("DELETE /api/admin/tenants/:id returns 404 for already-deleted tenant", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const tenant = await harness.seedTenant("gone-already");
    await harness.runSql("UPDATE tenants SET deleted_at = unixepoch() WHERE id = ?", [tenant.id]);
    const res = await harness.request(`/api/admin/tenants/${tenant.id}`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("POST /api/admin/tenants/:id/restore returns 404 for non-existent tenant", async () => {
    await harness.seedUser({ email: "superadmin@example.com", isSuperAdmin: true });
    const res = await harness.request(`/api/admin/tenants/${crypto.randomUUID()}/restore`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});
