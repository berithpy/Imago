import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

// Mocks: better-auth + email. Each test that needs a different session user
// re-overrides `getSession` via the exported `auth` mock.
const sessionEmail = { current: "admin@example.com" as string };
const signUpEmailMock = vi.fn(async () => ({ ok: true }));
const signInMagicLinkMock = vi.fn(async () => ({ ok: true }));

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      getSession: vi.fn(async () => ({ user: { email: sessionEmail.current } })),
      signUpEmail: signUpEmailMock,
      signInMagicLink: signInMagicLinkMock,
    },
  })),
}));

vi.mock("../../lib/email", async () => {
  const actual = await vi.importActual<typeof import("../../lib/email")>("../../lib/email");
  return {
    ...actual,
    sendEmail: vi.fn(async () => undefined),
  };
});

let harness: WorkerTestHarness;

/**
 * Create an org for a tenant and add a user as a member with the given role.
 * Returns the orgId for further mutations.
 */
async function attachOrg(tenantId: string, slug: string): Promise<string> {
  const orgId = crypto.randomUUID();
  await harness.runSql(
    "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())",
    [orgId, `${slug}-org`, `${slug}-org`]
  );
  await harness.runSql("UPDATE tenants SET organization_id = ? WHERE id = ?", [orgId, tenantId]);
  return orgId;
}

async function addMember(orgId: string, userId: string, role: string) {
  await harness.runSql(
    "INSERT INTO member (id, userId, organizationId, role, createdAt) VALUES (?, ?, ?, ?, unixepoch())",
    [crypto.randomUUID(), userId, orgId, role]
  );
}

describe("tenant member-management routes", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
    sessionEmail.current = "admin@example.com";
    signUpEmailMock.mockClear();
    signInMagicLinkMock.mockClear();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  // ----------------------------------------------------------------
  // GET /api/t/:slug/admin/members
  // ----------------------------------------------------------------

  it("GET /members lists tenant members with role + email (any direct member can read)", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const operator = await harness.seedUser({ email: "admin@example.com", name: "Op" });
    const collab = await harness.seedUser({ email: "collab@example.com", name: "Collab" });
    await addMember(orgId, operator.id, "tenant_operator");
    await addMember(orgId, collab.id, "tenant_collaborator");

    const res = await harness.request("/api/t/acme/admin/members");
    expect(res.status).toBe(200);
    const { members } = (await res.json()) as { members: Array<{ email: string; role: string }> };
    expect(members).toHaveLength(2);
    const byEmail = Object.fromEntries(members.map((m) => [m.email, m.role]));
    expect(byEmail["admin@example.com"]).toBe("tenant_operator");
    expect(byEmail["collab@example.com"]).toBe("tenant_collaborator");
  });

  it("GET /members returns 403 for an authenticated non-member", async () => {
    await harness.seedUser({ email: "admin@example.com" });
    const tenant = await harness.seedTenant("acme");
    await attachOrg(tenant.id, "acme");
    // No membership for admin@example.com.

    const res = await harness.request("/api/t/acme/admin/members");
    expect(res.status).toBe(403);
  });

  // ----------------------------------------------------------------
  // POST /api/t/:slug/admin/members/invite
  // ----------------------------------------------------------------

  it("POST /members/invite creates user, attaches membership with requested role, sends magic link", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const operator = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, operator.id, "tenant_operator");

    // Simulate signUpEmail side effect (better-auth would create the user row).
    (signUpEmailMock as any).mockImplementationOnce(async ({ body }: any) => {
      await harness.runSql(
        "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, unixepoch(), unixepoch())",
        [crypto.randomUUID(), body.name, body.email]
      );
      return { ok: true };
    });

    const res = await harness.request("/api/t/acme/admin/members/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", name: "New Hire", role: "tenant_collaborator" }),
    });
    expect(res.status).toBe(201);

    const newUser = await harness.env.DB.prepare(
      "SELECT id FROM user WHERE lower(email) = ?"
    ).bind("new@example.com").first<{ id: string }>();
    expect(newUser).toBeTruthy();

    const member = await harness.env.DB.prepare(
      "SELECT role FROM member WHERE userId = ? AND organizationId = ?"
    ).bind(newUser!.id, orgId).first<{ role: string }>();
    expect(member?.role).toBe("tenant_collaborator");

    expect(signInMagicLinkMock).toHaveBeenCalledTimes(1);
  });

  it("POST /members/invite rejects invalid role values", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, op.id, "tenant_operator");

    const res = await harness.request("/api/t/acme/admin/members/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@example.com", name: "X", role: "imago_operator" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /members/invite returns 403 for a tenant_collaborator (cannot manage members)", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const collab = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, collab.id, "tenant_collaborator");

    const res = await harness.request("/api/t/acme/admin/members/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@example.com", name: "X", role: "tenant_collaborator" }),
    });
    expect(res.status).toBe(403);
  });

  // ----------------------------------------------------------------
  // PATCH /api/t/:slug/admin/members/:userId/role
  // ----------------------------------------------------------------

  it("PATCH /members/:userId/role updates role of an existing member", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    const target = await harness.seedUser({ email: "target@example.com" });
    await addMember(orgId, op.id, "tenant_operator");
    await addMember(orgId, target.id, "tenant_collaborator");

    const res = await harness.request(`/api/t/acme/admin/members/${target.id}/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "sub_tenant_operator" }),
    });
    expect(res.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT role FROM member WHERE userId = ? AND organizationId = ?"
    ).bind(target.id, orgId).first<{ role: string }>();
    expect(row?.role).toBe("sub_tenant_operator");
  });

  it("PATCH /members/:userId/role returns 404 for a non-member of this tenant", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    const stranger = await harness.seedUser({ email: "stranger@example.com" });
    await addMember(orgId, op.id, "tenant_operator");

    const res = await harness.request(`/api/t/acme/admin/members/${stranger.id}/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "tenant_collaborator" }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /members/:userId/role refuses to demote the last tenant_operator", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, op.id, "tenant_operator");

    const res = await harness.request(`/api/t/acme/admin/members/${op.id}/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "tenant_collaborator" }),
    });
    expect(res.status).toBe(409);
  });

  // ----------------------------------------------------------------
  // DELETE /api/t/:slug/admin/members/:userId
  // ----------------------------------------------------------------

  it("DELETE /members/:userId removes the membership row", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    const target = await harness.seedUser({ email: "target@example.com" });
    await addMember(orgId, op.id, "tenant_operator");
    await addMember(orgId, target.id, "tenant_collaborator");

    const res = await harness.request(`/api/t/acme/admin/members/${target.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT 1 FROM member WHERE userId = ? AND organizationId = ?"
    ).bind(target.id, orgId).first();
    expect(row).toBeNull();
  });

  it("DELETE /members/:userId refuses to remove the last tenant_operator", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, op.id, "tenant_operator");

    const res = await harness.request(`/api/t/acme/admin/members/${op.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(409);
  });
});
