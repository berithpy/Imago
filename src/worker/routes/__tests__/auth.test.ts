import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

const { mockSignInMagicLink, mockGetSession } = vi.hoisted(() => ({
  mockSignInMagicLink: vi.fn(async () => ({ ok: true })),
  mockGetSession: vi.fn(async () => null),
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
let fixtures: {
  privateLogin: { id: string; slug: string; password: string };
  publicLogin: { id: string; slug: string; password: string };
  magicLink: { id: string; slug: string; password: string };
  privatePhotos: { id: string; slug: string; password: string };
  publicPhotos: { id: string; slug: string; password: string };
};

async function resetMutableAuthState() {
  const statements = [
    "DELETE FROM gallery_allowed_emails",
    "DELETE FROM app_config",
    "DELETE FROM user",
    "DELETE FROM admin_log",
    "DELETE FROM session",
    "DELETE FROM account",
    "DELETE FROM verification",
  ];

  for (const statement of statements) {
    await harness.runSql(statement);
  }
}

describe("auth routes", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
    await harness.resetDb();
    fixtures = {
      privateLogin: await harness.seedGallery({ slug: "private-login", isPublic: false, password: "correct-pass" }),
      publicLogin: await harness.seedGallery({ slug: "public-login", isPublic: true }),
      magicLink: await harness.seedGallery({ slug: "magic-link", isPublic: false }),
      privatePhotos: await harness.seedGallery({ slug: "private-photos", isPublic: false, password: "abc123" }),
      publicPhotos: await harness.seedGallery({ slug: "public-photos", isPublic: true }),
    };
  });

  beforeEach(async () => {
    await resetMutableAuthState();
    mockSignInMagicLink.mockClear();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(null);
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("POST /api/viewer/gallery/:slug/login returns 401 for wrong password and sets cookie for correct password", async () => {
    const wrongRes = await harness.request(`/api/viewer/gallery/${fixtures.privateLogin.slug}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong-pass" }),
    });
    expect(wrongRes.status).toBe(401);

    const okRes = await harness.request(`/api/viewer/gallery/${fixtures.privateLogin.slug}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "correct-pass" }),
    });
    expect(okRes.status).toBe(200);
    const setCookie = okRes.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("viewer_token=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("POST /api/viewer/gallery/:slug/login accepts public gallery without password", async () => {
    const res = await harness.request(`/api/viewer/gallery/${fixtures.publicLogin.slug}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain("viewer_token=");
  });

  it("POST /api/viewer/gallery/:slug/magic-link enforces whitelist", async () => {
    const denied = await harness.request(`/api/viewer/gallery/${fixtures.magicLink.slug}/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "blocked@example.com" }),
    });
    expect(denied.status).toBe(403);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();

    await harness.runSql(
      "INSERT INTO gallery_allowed_emails (id, gallery_id, email, added_at) VALUES (?, ?, ?, unixepoch())",
      [crypto.randomUUID(), fixtures.magicLink.id, "allowed@example.com"]
    );

    const allowed = await harness.request(`/api/viewer/gallery/${fixtures.magicLink.slug}/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "allowed@example.com", callbackPath: `/gallery/${fixtures.magicLink.slug}/photo/abc` }),
    });

    expect(allowed.status).toBe(200);
    expect(mockSignInMagicLink).toHaveBeenCalledTimes(1);
    expect(mockSignInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "allowed@example.com",
          callbackURL: `/gallery/${fixtures.magicLink.slug}/photo/abc`,
        }),
      })
    );
  });

  it("GET /api/galleries/:slug/photos returns 401 for private gallery without auth and 200 with viewer token", async () => {
    const unauthenticated = await harness.request(`/api/galleries/${fixtures.privatePhotos.slug}/photos`);
    expect(unauthenticated.status).toBe(401);

    const loginRes = await harness.request(`/api/viewer/gallery/${fixtures.privatePhotos.slug}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "abc123" }),
    });
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const authed = await harness.request(`/api/galleries/${fixtures.privatePhotos.slug}/photos`, {
      headers: { cookie },
    });
    expect(authed.status).toBe(200);
    const payload = await authed.json() as { photos: unknown[]; total: number; nextCursor: string | null };
    expect(Array.isArray(payload.photos)).toBe(true);
    expect(payload.total).toBe(0);
    expect(payload.nextCursor).toBeNull();
  });

  it("GET /api/galleries/:slug/photos returns 200 for public gallery without auth", async () => {
    const res = await harness.request(`/api/galleries/${fixtures.publicPhotos.slug}/photos`);
    expect(res.status).toBe(200);
  });

  it("POST /api/viewer/admin/magic-link validates format and does not leak non-admin account existence", async () => {
    const bad = await harness.request("/api/viewer/admin/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(bad.status).toBe(400);

    await harness.runSql(
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, unixepoch(), unixepoch())",
      [crypto.randomUUID(), "Admin", "admin@example.com", 1]
    );

    const nonAdmin = await harness.request("/api/viewer/admin/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "other@example.com" }),
    });
    expect(nonAdmin.status).toBe(200);
    expect(await nonAdmin.json()).toEqual({ ok: true });
    expect(mockSignInMagicLink).not.toHaveBeenCalled();

    const admin = await harness.request("/api/viewer/admin/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com" }),
    });
    expect(admin.status).toBe(200);
    expect(mockSignInMagicLink).toHaveBeenCalledTimes(1);
  });

  it("POST /api/viewer/admin/recover-by-email always returns ok and only sends when configured", async () => {
    const noConfig = await harness.request("/api/viewer/admin/recover-by-email", {
      method: "POST",
    });
    expect(noConfig.status).toBe(200);
    expect(await noConfig.json()).toEqual({ ok: true });
    expect(mockSignInMagicLink).not.toHaveBeenCalled();

    await harness.runSql(
      "INSERT INTO app_config (key, value) VALUES ('recovery_email', ?)",
      ["recover@example.com"]
    );

    const configured = await harness.request("/api/viewer/admin/recover-by-email", {
      method: "POST",
    });
    expect(configured.status).toBe(200);
    expect(await configured.json()).toEqual({ ok: true });
    expect(mockSignInMagicLink).toHaveBeenCalledTimes(1);
    expect(mockSignInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "recover@example.com",
          callbackURL: "/admin",
        }),
      })
    );
  });
});
