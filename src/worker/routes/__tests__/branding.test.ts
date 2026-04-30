import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      getSession: vi.fn(async () => ({ user: { email: "admin@example.com" } })),
      signUpEmail: vi.fn(async () => ({ ok: true })),
    },
  })),
}));

let harness: WorkerTestHarness;

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

describe("tenant branding overrides", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("GET /branding returns {} when no overrides set", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, op.id, "tenant_operator");

    const res = await harness.request("/api/t/acme/admin/branding");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ branding: {} });
  });

  it("GET /branding returns parsed JSON when set", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, op.id, "tenant_operator");
    await harness.runSql("UPDATE tenants SET branding_overrides = ? WHERE id = ?", [
      JSON.stringify({ primaryColor: "#abc123", logoUrl: "https://x/logo.png" }),
      tenant.id,
    ]);

    const res = await harness.request("/api/t/acme/admin/branding");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      branding: { primaryColor: "#abc123", logoUrl: "https://x/logo.png" },
    });
  });

  it("PATCH /branding writes the JSON column", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, op.id, "tenant_operator");

    const res = await harness.request("/api/t/acme/admin/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ primaryColor: "#222222", accentColor: "#facade" }),
    });
    expect(res.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT branding_overrides AS branding FROM tenants WHERE id = ?"
    )
      .bind(tenant.id)
      .first<{ branding: string | null }>();
    expect(JSON.parse(row?.branding ?? "{}")).toEqual({
      primaryColor: "#222222",
      accentColor: "#facade",
    });
  });

  it("PATCH /branding rejects non-object body with 400", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, op.id, "tenant_operator");

    const res = await harness.request("/api/t/acme/admin/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify("not-an-object"),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /branding returns 403 for a tenant_collaborator", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const collab = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, collab.id, "tenant_collaborator");

    const res = await harness.request("/api/t/acme/admin/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ primaryColor: "#000" }),
    });
    expect(res.status).toBe(403);
  });

  it("DELETE /branding clears the overrides", async () => {
    const tenant = await harness.seedTenant("acme");
    const orgId = await attachOrg(tenant.id, "acme");
    const op = await harness.seedUser({ email: "admin@example.com" });
    await addMember(orgId, op.id, "tenant_operator");
    await harness.runSql("UPDATE tenants SET branding_overrides = ? WHERE id = ?", [
      JSON.stringify({ primaryColor: "#000" }),
      tenant.id,
    ]);

    const res = await harness.request("/api/t/acme/admin/branding", { method: "DELETE" });
    expect(res.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT branding_overrides AS branding FROM tenants WHERE id = ?"
    )
      .bind(tenant.id)
      .first<{ branding: string | null }>();
    expect(row?.branding).toBeNull();
  });
});
