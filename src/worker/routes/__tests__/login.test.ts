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
    "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, unixepoch(), unixepoch())",
    [id, email, email]
  );
  if (isSuperAdmin) {
    await harness.runSql(
      "INSERT OR IGNORE INTO organization (id, name, slug, createdAt) VALUES ('imago-platform', 'Imago Platform', 'imago', unixepoch())",
      []
    );
    await harness.runSql(
      "INSERT INTO member (id, userId, organizationId, role, createdAt) VALUES (?, ?, 'imago-platform', 'imago_operator', unixepoch())",
      [crypto.randomUUID(), id]
    );
  }
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
});
