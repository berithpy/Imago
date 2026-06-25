import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

const { mockGetSession, mockSignUpEmail, mockSendEmail, mockSignInMagicLink } = vi.hoisted(() => ({
  mockGetSession: vi.fn<() => Promise<{ user: { email: string } } | null>>(async () => ({ user: { email: "admin@example.com" } })),
  mockSignUpEmail: vi.fn(async ({ body }: { body: { email: string; name: string } }) => ({
    user: { id: crypto.randomUUID(), email: body.email, name: body.name },
  })),
  mockSendEmail: vi.fn(async () => undefined),
  mockSignInMagicLink: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      getSession: mockGetSession,
      signUpEmail: mockSignUpEmail,
      signInMagicLink: mockSignInMagicLink,
    },
  })),
}));

vi.mock("../../lib/email", async () => {
  const actual = await vi.importActual<typeof import("../../lib/email")>("../../lib/email");
  return {
    ...actual,
    sendEmail: mockSendEmail,
  };
});

let harness: WorkerTestHarness;

describe("admin routes", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue({ user: { email: "admin@example.com" } });
    mockSignUpEmail.mockClear();
    mockSendEmail.mockClear();
    mockSignInMagicLink.mockClear();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("POST /api/tenant/setup creates admin and stores recovery email", async () => {
    const res = await harness.request("/api/tenant/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.com",
        password: "secret123",
        name: "Owner",
        recoveryEmail: "recover@example.com",
      }),
    });

    expect(res.status).toBe(200);
    const payload = await res.json() as { ok: boolean };
    expect(payload.ok).toBe(true);

    const recovery = await harness.env.DB.prepare(
      "SELECT value FROM app_config WHERE key = 'recovery_email'"
    ).first<{ value: string }>();
    expect(recovery?.value).toBe("recover@example.com");
  });

  it("protects admin routes with session middleware", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const res = await harness.request("/api/tenant/galleries");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 on key admin endpoints when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const testCases: Array<{ path: string; init?: RequestInit }> = [
      { path: "/api/tenant/galleries" },
      {
        path: "/api/tenant/galleries",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Nope", slug: "nope", password: "pw1234" }),
        },
      },
      { path: `/api/tenant/galleries/${crypto.randomUUID()}/viewer-bypass`, init: { method: "POST" } },
      { path: `/api/tenant/galleries/${crypto.randomUUID()}/allowed-emails` },
      {
        path: `/api/tenant/galleries/${crypto.randomUUID()}/allowed-emails`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "guest@example.com" }),
        },
      },
      { path: "/api/tenant/log" },
      { path: "/api/tenant/users" },
      {
        path: "/api/tenant/users/invite",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "invitee@example.com", name: "Invitee" }),
        },
      },
    ];

    for (const testCase of testCases) {
      const res = await harness.request(testCase.path, testCase.init);
      expect(res.status, `${testCase.init?.method ?? "GET"} ${testCase.path}`).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    }
  });

  it("returns 403 on superAdmin-only endpoints when session user is not a platform operator", async () => {
    // Authenticated session, but the user is not a member of the imago org.
    await harness.seedUser({ email: "admin@example.com" });

    const cases: Array<{ path: string; init?: RequestInit; status: number }> = [
      { path: "/api/tenant/log", status: 403 },
      {
        path: "/api/tenant/users/invite",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "x@example.com", name: "X" }),
        },
        status: 403,
      },
      {
        path: `/api/tenant/galleries/${crypto.randomUUID()}/permanent`,
        init: { method: "DELETE" },
        status: 403,
      },
    ];

    for (const tc of cases) {
      const res = await harness.request(tc.path, tc.init);
      expect(res.status, `${tc.init?.method ?? "GET"} ${tc.path}`).toBe(tc.status);
    }
  });

  it("POST + GET /api/tenant/galleries creates then lists gallery", async () => {
    const createRes = await harness.request("/api/tenant/galleries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Wedding",
        slug: "wedding-2026",
        password: "pw1234",
        description: "Event",
      }),
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json() as { gallery: { id: string; slug: string } };
    expect(created.gallery.slug).toBe("wedding-2026");

    const listRes = await harness.request("/api/tenant/galleries");
    expect(listRes.status).toBe(200);
    const listPayload = await listRes.json() as { galleries: Array<{ id: string; slug: string }> };
    expect(listPayload.galleries.some((g) => g.id === created.gallery.id)).toBe(true);
  });

  it("GET /api/tenant/galleries resolves thumbnail r2 keys from banner or first photo", async () => {
    const fallbackGallery = await harness.seedGallery({ slug: "admin-thumb-fallback", isPublic: false });
    const fallbackLaterId = crypto.randomUUID();
    const fallbackFirstId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [fallbackLaterId, fallbackGallery.id, `${fallbackGallery.id}/later.jpg`, "later.jpg", 101, 2]
    );
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [fallbackFirstId, fallbackGallery.id, `${fallbackGallery.id}/first.jpg`, "first.jpg", 102, 1]
    );

    const preferredGallery = await harness.seedGallery({ slug: "admin-thumb-banner", isPublic: false });
    const preferredFirstId = crypto.randomUUID();
    const preferredBannerId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [preferredFirstId, preferredGallery.id, `${preferredGallery.id}/first.jpg`, "first.jpg", 103, 1]
    );
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [preferredBannerId, preferredGallery.id, `${preferredGallery.id}/banner.jpg`, "banner.jpg", 104, 2]
    );
    await harness.runSql(
      "UPDATE galleries SET banner_photo_id = ? WHERE id = ?",
      [preferredBannerId, preferredGallery.id]
    );

    const res = await harness.request("/api/tenant/galleries");
    expect(res.status).toBe(200);
    const body = await res.json() as {
      galleries: Array<{ slug: string; banner_r2_key: string | null }>;
    };

    expect(body.galleries.find((gallery) => gallery.slug === "admin-thumb-fallback")?.banner_r2_key)
      .toBe(`${fallbackGallery.id}/first.jpg`);
    expect(body.galleries.find((gallery) => gallery.slug === "admin-thumb-banner")?.banner_r2_key)
      .toBe(`${preferredGallery.id}/banner.jpg`);
  });

  it("DELETE /api/tenant/galleries/:id soft-deletes and restore clears deleted_at", async () => {
    const createRes = await harness.request("/api/tenant/galleries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Party", slug: "party-1", password: "pw1234" }),
    });
    const created = await createRes.json() as { gallery: { id: string } };

    const delRes = await harness.request(`/api/tenant/galleries/${created.gallery.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    const deletedRow = await harness.env.DB.prepare(
      "SELECT deleted_at FROM galleries WHERE id = ?"
    ).bind(created.gallery.id).first<{ deleted_at: number | null }>();
    expect(deletedRow?.deleted_at).not.toBeNull();

    const restoreRes = await harness.request(`/api/tenant/galleries/${created.gallery.id}/restore`, {
      method: "POST",
    });
    expect(restoreRes.status).toBe(200);

    const restoredRow = await harness.env.DB.prepare(
      "SELECT deleted_at FROM galleries WHERE id = ?"
    ).bind(created.gallery.id).first<{ deleted_at: number | null }>();
    expect(restoredRow?.deleted_at).toBeNull();
  });

  it("POST /api/tenant/galleries/:id/viewer-bypass issues viewer_token cookie", async () => {
    const createRes = await harness.request("/api/tenant/galleries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bypass", slug: "bypass-1", password: "pw1234" }),
    });
    const created = await createRes.json() as { gallery: { id: string; slug: string } };

    const bypassRes = await harness.request(`/api/tenant/galleries/${created.gallery.id}/viewer-bypass`, {
      method: "POST",
    });

    expect(bypassRes.status).toBe(200);
    expect(bypassRes.headers.get("set-cookie") ?? "").toContain("viewer_token=");
  });

  it("allowed-emails add/get/delete flow works and sends invite email", async () => {
    const gallery = await harness.seedGallery({ slug: "allowlist-gal", isPublic: false });

    const addRes = await harness.request(`/api/tenant/galleries/${gallery.id}/allowed-emails`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "guest@example.com" }),
    });
    expect(addRes.status).toBe(201);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const listRes = await harness.request(`/api/tenant/galleries/${gallery.id}/allowed-emails`);
    expect(listRes.status).toBe(200);
    const listPayload = await listRes.json() as { allowedEmails: Array<{ email: string }> };
    expect(listPayload.allowedEmails.some((e) => e.email === "guest@example.com")).toBe(true);

    const delRes = await harness.request(
      `/api/tenant/galleries/${gallery.id}/allowed-emails/${encodeURIComponent("guest@example.com")}`,
      { method: "DELETE" }
    );
    expect(delRes.status).toBe(200);

    const listRes2 = await harness.request(`/api/tenant/galleries/${gallery.id}/allowed-emails`);
    const listPayload2 = await listRes2.json() as { allowedEmails: Array<{ email: string }> };
    expect(listPayload2.allowedEmails).toHaveLength(0);
  });

  it("PATCH settings endpoints update gallery fields", async () => {
    const gallery = await harness.seedGallery({ slug: "settings-gal", isPublic: false, password: "pw1234" });

    const visibilityRes = await harness.request(`/api/tenant/galleries/${gallery.id}/visibility`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_public: true }),
    });
    expect(visibilityRes.status).toBe(200);

    const settingsRes = await harness.request(`/api/tenant/galleries/${gallery.id}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated Name", description: "Updated Desc" }),
    });
    expect(settingsRes.status).toBe(200);

    const passwordRes = await harness.request(`/api/tenant/galleries/${gallery.id}/password`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "new-password" }),
    });
    expect(passwordRes.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT name, description, is_public FROM galleries WHERE id = ?"
    ).bind(gallery.id).first<{ name: string; description: string | null; is_public: number }>();
    expect(row?.name).toBe("Updated Name");
    expect(row?.description).toBe("Updated Desc");
    expect(row?.is_public).toBe(1);
  });

  it("PATCH /settings can toggle share_preview_enabled", async () => {
    const gallery = await harness.seedGallery({ slug: "share-preview-gal", isPublic: false, password: "pw1234" });

    const enableRes = await harness.request(`/api/tenant/galleries/${gallery.id}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ share_preview_enabled: true }),
    });
    expect(enableRes.status).toBe(200);

    const enabledRow = await harness.env.DB.prepare(
      "SELECT share_preview_enabled FROM galleries WHERE id = ?"
    ).bind(gallery.id).first<{ share_preview_enabled: number }>();
    expect(enabledRow?.share_preview_enabled).toBe(1);

    const disableRes = await harness.request(`/api/tenant/galleries/${gallery.id}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ share_preview_enabled: false }),
    });
    expect(disableRes.status).toBe(200);

    const disabledRow = await harness.env.DB.prepare(
      "SELECT share_preview_enabled FROM galleries WHERE id = ?"
    ).bind(gallery.id).first<{ share_preview_enabled: number }>();
    expect(disabledRow?.share_preview_enabled).toBe(0);
  });

  it("PATCH /banner sets banner photo id", async () => {
    const gallery = await harness.seedGallery({ slug: "banner-gal", isPublic: false });
    const photoId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, gallery.id, `galleries/${gallery.id}/${photoId}.jpg`, "banner.jpg", 123, 1]
    );

    const res = await harness.request(`/api/tenant/galleries/${gallery.id}/banner`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    expect(res.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT banner_photo_id FROM galleries WHERE id = ?"
    ).bind(gallery.id).first<{ banner_photo_id: string | null }>();
    expect(row?.banner_photo_id).toBe(photoId);
  });

  it("GET /photos and /export return seeded photos", async () => {
    const gallery = await harness.seedGallery({ slug: "export-gal", isPublic: false });
    const photoId = crypto.randomUUID();
    const r2Key = `galleries/${gallery.id}/${photoId}.jpg`;
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, gallery.id, r2Key, "seeded.jpg", 456, 1]
    );

    const photosRes = await harness.request(`/api/tenant/galleries/${gallery.id}/photos`);
    expect(photosRes.status).toBe(200);
    const photosPayload = await photosRes.json() as { photos: Array<{ id: string }> };
    expect(photosPayload.photos.some((p) => p.id === photoId)).toBe(true);

    const exportRes = await harness.request(`/api/tenant/galleries/${gallery.id}/export`);
    expect(exportRes.status).toBe(200);
    const exportPayload = await exportRes.json() as { photos: Array<{ url: string }> };
    expect(exportPayload.photos.some((p) => p.url.includes(r2Key))).toBe(true);
  });

  it("DELETE /permanent removes gallery and its photos", async () => {
    // Permanent delete is operator-level only, so seed the session user as
    // a platform operator (no tenantId in context on the global mount).
    await harness.seedUser({ email: "admin@example.com", isSuperAdmin: true });
    const gallery = await harness.seedGallery({ slug: "perm-gal", isPublic: false });
    const photoId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, gallery.id, `galleries/${gallery.id}/${photoId}.jpg`, "seeded.jpg", 456, 1]
    );

    const res = await harness.request(`/api/tenant/galleries/${gallery.id}/permanent`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const galleryRow = await harness.env.DB.prepare("SELECT id FROM galleries WHERE id = ?").bind(gallery.id).first();
    const photoRow = await harness.env.DB.prepare("SELECT id FROM photos WHERE id = ?").bind(photoId).first();
    expect(galleryRow).toBeNull();
    expect(photoRow).toBeNull();
  });

  it("GET /users and POST /users/invite work and create admin log entry", async () => {
    await harness.seedUser({ email: "admin@example.com", isSuperAdmin: true });
    await harness.runSql(
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, unixepoch(), unixepoch())",
      [crypto.randomUUID(), "Existing", "existing@example.com", 1]
    );

    const usersRes = await harness.request("/api/tenant/users");
    expect(usersRes.status).toBe(200);
    const usersPayload = await usersRes.json() as { users: Array<{ email: string }> };
    expect(usersPayload.users.some((u) => u.email === "existing@example.com")).toBe(true);

    const inviteRes = await harness.request("/api/tenant/users/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invitee@example.com", name: "Invitee" }),
    });
    expect(inviteRes.status).toBe(200);
    expect(mockSignUpEmail).toHaveBeenCalledTimes(1);
    expect(mockSignInMagicLink).toHaveBeenCalledTimes(1);
    expect(mockSignInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "invitee@example.com",
          callbackURL: "/login/resolve",
        }),
      })
    );

    const logRes = await harness.request("/api/tenant/log");
    expect(logRes.status).toBe(200);
    const logPayload = await logRes.json() as { log: Array<{ event: string }> };
    expect(logPayload.log.some((entry) => entry.event === "USER_INVITED")).toBe(true);
  });

  it("GET /api/tenant/galleries/by-slug/:slug returns gallery + photos", async () => {
    const gallery = await harness.seedGallery({ slug: "by-slug-gal", isPublic: false });
    const photoId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, gallery.id, `galleries/${gallery.id}/${photoId}.jpg`, "p.jpg", 100, 1]
    );

    const res = await harness.request(`/api/tenant/galleries/by-slug/${gallery.slug}`);
    expect(res.status).toBe(200);
    const payload = await res.json() as {
      gallery: { id: string; slug: string };
      photos: Array<{ id: string }>;
    };
    expect(payload.gallery.id).toBe(gallery.id);
    expect(payload.gallery.slug).toBe(gallery.slug);
    expect(payload.photos.some((p) => p.id === photoId)).toBe(true);
  });

  it("GET /api/tenant/galleries/by-slug/:slug returns 404 when missing", async () => {
    const res = await harness.request("/api/tenant/galleries/by-slug/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Gallery not found" });
  });

  it("GET /api/tenant/galleries/by-slug/:slug ignores soft-deleted galleries", async () => {
    const gallery = await harness.seedGallery({ slug: "soft-del-gal", isPublic: false });
    await harness.runSql(
      "UPDATE galleries SET deleted_at = unixepoch() WHERE id = ?",
      [gallery.id]
    );
    const res = await harness.request(`/api/tenant/galleries/by-slug/${gallery.slug}`);
    expect(res.status).toBe(404);
  });

  it("POST /api/tenant/galleries rejects reserved slugs", async () => {
    for (const slug of ["manage", "login", "setup", "settings", "admin"]) {
      const res = await harness.request("/api/tenant/galleries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Reserved", slug, password: "pw1234" }),
      });
      expect(res.status, `slug=${slug}`).toBe(400);
      expect(await res.json()).toEqual({ error: "Slug is reserved" });
    }
  });

  it("GET /api/tenant/galleries/check-slug flags reserved slugs", async () => {
    const res = await harness.request("/api/tenant/galleries/check-slug?slug=manage");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, available: false, reserved: true });
  });

  // ------------------------------------------------------------------
  // admin_log actor tracking
  // ------------------------------------------------------------------

  it("logs GALLERY_CREATED with imago_operator actor when super-admin creates", async () => {
    const user = await harness.seedUser({
      email: "admin@example.com",
      isSuperAdmin: true,
    });
    mockGetSession.mockResolvedValue({ user: { email: user.email } });

    const res = await harness.request("/api/tenant/galleries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Logged", slug: "logged-gal", password: "pw1234" }),
    });
    expect(res.status).toBe(201);

    const log = await harness.env.DB.prepare(
      "SELECT actor_type, actor_user_id, detail FROM admin_log WHERE event = 'GALLERY_CREATED'"
    ).first<{ actor_type: string; actor_user_id: string; detail: string }>();
    expect(log?.actor_type).toBe("imago_operator");
    expect(log?.actor_user_id).toBe(user.id);
    expect(log?.detail).toBe("logged-gal");
  });

  it("logs ADMIN_SETUP with system actor", async () => {
    await harness.request("/api/tenant/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "first@example.com", password: "secret123", name: "First" }),
    });

    const log = await harness.env.DB.prepare(
      "SELECT actor_type FROM admin_log WHERE event = 'ADMIN_SETUP'"
    ).first<{ actor_type: string }>();
    expect(log?.actor_type).toBe("system");
  });
});
