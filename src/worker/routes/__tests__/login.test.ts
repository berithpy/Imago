import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

const { mockSignInMagicLink, mockGetSession } = vi.hoisted(() => ({
  mockSignInMagicLink: vi.fn(async () => ({ ok: true })),
  mockGetSession: vi.fn<() => Promise<{ user: { id: string; email: string } } | null>>(async () => null),
}));

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      signInMagicLink: mockSignInMagicLink,
      getSession: mockGetSession,
      signUpEmail: vi.fn(async () => ({ ok: true })),
    },
  })),
}));

let harness: WorkerTestHarness;

async function seedUser(id: string, email: string, isSuperAdmin = false) {
  await harness.runSql(
    "INSERT INTO user (id, name, email, emailVerified, is_super_admin, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, unixepoch(), unixepoch())",
    [id, email, email, isSuperAdmin ? 1 : 0]
  );
}

async function seedTenantOrg(slug: string, name = slug) {
  const tenantId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await harness.runSql(
    "INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())",
    [orgId, name, slug]
  );
  await harness.runSql(
    "INSERT INTO tenants (id, slug, name, organization_id, created_at) VALUES (?, ?, ?, ?, unixepoch())",
    [tenantId, slug, name, orgId]
  );
  return { tenantId, orgId };
}

async function addMember(userId: string, orgId: string) {
  await harness.runSql(
    "INSERT INTO member (id, organizationId, userId, role, createdAt) VALUES (?, ?, ?, 'member', unixepoch())",
    [crypto.randomUUID(), orgId, userId]
  );
}

describe("login routes (universal)", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
    mockSignInMagicLink.mockClear();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(null);
  });

  afterAll(async () => {
    await harness.dispose();
  });

  describe("POST /api/login/magic-link", () => {
    it("returns 400 for invalid email format", async () => {
      const res = await harness.request("/api/login/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      });
      expect(res.status).toBe(400);
      expect(mockSignInMagicLink).not.toHaveBeenCalled();
    });

    it("returns ok and does not send for unknown email (no enumeration)", async () => {
      const res = await harness.request("/api/login/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "ghost@example.com" }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(mockSignInMagicLink).not.toHaveBeenCalled();
    });

    it("sends magic link for super-admin user", async () => {
      const userId = crypto.randomUUID();
      await seedUser(userId, "boss@example.com", true);

      const res = await harness.request("/api/login/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "boss@example.com" }),
      });
      expect(res.status).toBe(200);
      expect(mockSignInMagicLink).toHaveBeenCalledTimes(1);
      expect(mockSignInMagicLink).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            email: "boss@example.com",
            callbackURL: "/login/resolve",
          }),
        })
      );
    });

    it("sends magic link for tenant member user", async () => {
      const userId = crypto.randomUUID();
      await seedUser(userId, "studio@example.com");
      const { orgId } = await seedTenantOrg("studio-a");
      await addMember(userId, orgId);

      const res = await harness.request("/api/login/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "studio@example.com" }),
      });
      expect(res.status).toBe(200);
      expect(mockSignInMagicLink).toHaveBeenCalledTimes(1);
    });

    it("does not send for known user with no membership and not super-admin", async () => {
      const userId = crypto.randomUUID();
      await seedUser(userId, "orphan@example.com");

      const res = await harness.request("/api/login/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "orphan@example.com" }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(mockSignInMagicLink).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/login/resolve", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await harness.request("/api/login/resolve");
      expect(res.status).toBe(401);
    });

    it("returns superAdmin=true for super-admin user", async () => {
      const userId = crypto.randomUUID();
      await seedUser(userId, "boss@example.com", true);
      mockGetSession.mockResolvedValue({ user: { id: userId, email: "boss@example.com" } });

      const res = await harness.request("/api/login/resolve");
      expect(res.status).toBe(200);
      const data = await res.json() as { superAdmin: boolean; tenants: Array<{ slug: string }> };
      expect(data.superAdmin).toBe(true);
      expect(data.tenants).toEqual([]);
    });

    it("returns tenant list for member of multiple tenants", async () => {
      const userId = crypto.randomUUID();
      await seedUser(userId, "multi@example.com");
      const a = await seedTenantOrg("alpha", "Alpha");
      const b = await seedTenantOrg("bravo", "Bravo");
      await addMember(userId, a.orgId);
      await addMember(userId, b.orgId);
      mockGetSession.mockResolvedValue({ user: { id: userId, email: "multi@example.com" } });

      const res = await harness.request("/api/login/resolve");
      expect(res.status).toBe(200);
      const data = await res.json() as { superAdmin: boolean; tenants: Array<{ slug: string; name: string }> };
      expect(data.superAdmin).toBe(false);
      expect(data.tenants.map((t) => t.slug).sort()).toEqual(["alpha", "bravo"]);
    });

    it("excludes soft-deleted tenants", async () => {
      const userId = crypto.randomUUID();
      await seedUser(userId, "dropped@example.com");
      const a = await seedTenantOrg("active");
      const b = await seedTenantOrg("gone");
      await addMember(userId, a.orgId);
      await addMember(userId, b.orgId);
      await harness.runSql("UPDATE tenants SET deleted_at = unixepoch() WHERE id = ?", [b.tenantId]);
      mockGetSession.mockResolvedValue({ user: { id: userId, email: "dropped@example.com" } });

      const res = await harness.request("/api/login/resolve");
      const data = await res.json() as { tenants: Array<{ slug: string }> };
      expect(data.tenants.map((t) => t.slug)).toEqual(["active"]);
    });
  });
});
