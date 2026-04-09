import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

const { mockGetSession, mockSignUpEmail, mockSendEmail } = vi.hoisted(() => ({
  mockGetSession: vi.fn<() => Promise<{ user: { email: string } } | null>>(async () => ({ user: { email: "admin@example.com" } })),
  mockSignUpEmail: vi.fn(async ({ body }: { body: { email: string; name: string } }) => ({
    user: { id: crypto.randomUUID(), email: body.email, name: body.name },
  })),
  mockSendEmail: vi.fn(async () => undefined),
}));

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      getSession: mockGetSession,
      signUpEmail: mockSignUpEmail,
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
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("POST /api/admin/setup creates admin and stores recovery email", async () => {
    const res = await harness.request("/api/admin/setup", {
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

    const res = await harness.request("/api/admin/galleries");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 on key admin endpoints when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const testCases: Array<{ path: string; init?: RequestInit }> = [
      { path: "/api/admin/galleries" },
      {
        path: "/api/admin/galleries",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Nope", slug: "nope", password: "pw1234" }),
        },
      },
      { path: `/api/admin/galleries/${crypto.randomUUID()}/viewer-bypass`, init: { method: "POST" } },
      { path: `/api/admin/galleries/${crypto.randomUUID()}/allowed-emails` },
      {
        path: `/api/admin/galleries/${crypto.randomUUID()}/allowed-emails`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "guest@example.com" }),
        },
      },
      { path: "/api/admin/log" },
      { path: "/api/admin/users" },
      {
        path: "/api/admin/users/invite",
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

  it("POST + GET /api/admin/galleries creates then lists gallery", async () => {
    const createRes = await harness.request("/api/admin/galleries", {
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

    const listRes = await harness.request("/api/admin/galleries");
    expect(listRes.status).toBe(200);
    const listPayload = await listRes.json() as { galleries: Array<{ id: string; slug: string }> };
    expect(listPayload.galleries.some((g) => g.id === created.gallery.id)).toBe(true);
  });

  it("DELETE /api/admin/galleries/:id soft-deletes and restore clears deleted_at", async () => {
    const createRes = await harness.request("/api/admin/galleries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Party", slug: "party-1", password: "pw1234" }),
    });
    const created = await createRes.json() as { gallery: { id: string } };

    const delRes = await harness.request(`/api/admin/galleries/${created.gallery.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    const deletedRow = await harness.env.DB.prepare(
      "SELECT deleted_at FROM galleries WHERE id = ?"
    ).bind(created.gallery.id).first<{ deleted_at: number | null }>();
    expect(deletedRow?.deleted_at).not.toBeNull();

    const restoreRes = await harness.request(`/api/admin/galleries/${created.gallery.id}/restore`, {
      method: "POST",
    });
    expect(restoreRes.status).toBe(200);

    const restoredRow = await harness.env.DB.prepare(
      "SELECT deleted_at FROM galleries WHERE id = ?"
    ).bind(created.gallery.id).first<{ deleted_at: number | null }>();
    expect(restoredRow?.deleted_at).toBeNull();
  });

  it("POST /api/admin/galleries/:id/viewer-bypass issues viewer_token cookie", async () => {
    const createRes = await harness.request("/api/admin/galleries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bypass", slug: "bypass-1", password: "pw1234" }),
    });
    const created = await createRes.json() as { gallery: { id: string; slug: string } };

    const bypassRes = await harness.request(`/api/admin/galleries/${created.gallery.id}/viewer-bypass`, {
      method: "POST",
    });

    expect(bypassRes.status).toBe(200);
    expect(bypassRes.headers.get("set-cookie") ?? "").toContain("viewer_token=");
  });

  it("allowed-emails add/get/delete flow works and sends invite email", async () => {
    const gallery = await harness.seedGallery({ slug: "allowlist-gal", isPublic: false });

    const addRes = await harness.request(`/api/admin/galleries/${gallery.id}/allowed-emails`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "guest@example.com" }),
    });
    expect(addRes.status).toBe(201);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const listRes = await harness.request(`/api/admin/galleries/${gallery.id}/allowed-emails`);
    expect(listRes.status).toBe(200);
    const listPayload = await listRes.json() as { allowedEmails: Array<{ email: string }> };
    expect(listPayload.allowedEmails.some((e) => e.email === "guest@example.com")).toBe(true);

    const delRes = await harness.request(
      `/api/admin/galleries/${gallery.id}/allowed-emails/${encodeURIComponent("guest@example.com")}`,
      { method: "DELETE" }
    );
    expect(delRes.status).toBe(200);

    const listRes2 = await harness.request(`/api/admin/galleries/${gallery.id}/allowed-emails`);
    const listPayload2 = await listRes2.json() as { allowedEmails: Array<{ email: string }> };
    expect(listPayload2.allowedEmails).toHaveLength(0);
  });

  it("PATCH settings endpoints update gallery fields", async () => {
    const gallery = await harness.seedGallery({ slug: "settings-gal", isPublic: false, password: "pw1234" });

    const visibilityRes = await harness.request(`/api/admin/galleries/${gallery.id}/visibility`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_public: true }),
    });
    expect(visibilityRes.status).toBe(200);

    const settingsRes = await harness.request(`/api/admin/galleries/${gallery.id}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated Name", description: "Updated Desc" }),
    });
    expect(settingsRes.status).toBe(200);

    const passwordRes = await harness.request(`/api/admin/galleries/${gallery.id}/password`, {
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

  it("PATCH /banner sets banner photo id", async () => {
    const gallery = await harness.seedGallery({ slug: "banner-gal", isPublic: false });
    const photoId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, gallery.id, `galleries/${gallery.id}/${photoId}.jpg`, "banner.jpg", 123, 1]
    );

    const res = await harness.request(`/api/admin/galleries/${gallery.id}/banner`, {
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

    const photosRes = await harness.request(`/api/admin/galleries/${gallery.id}/photos`);
    expect(photosRes.status).toBe(200);
    const photosPayload = await photosRes.json() as { photos: Array<{ id: string }> };
    expect(photosPayload.photos.some((p) => p.id === photoId)).toBe(true);

    const exportRes = await harness.request(`/api/admin/galleries/${gallery.id}/export`);
    expect(exportRes.status).toBe(200);
    const exportPayload = await exportRes.json() as { photos: Array<{ url: string }> };
    expect(exportPayload.photos.some((p) => p.url.includes(r2Key))).toBe(true);
  });

  it("DELETE /permanent removes gallery and its photos", async () => {
    const gallery = await harness.seedGallery({ slug: "perm-gal", isPublic: false });
    const photoId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, gallery.id, `galleries/${gallery.id}/${photoId}.jpg`, "seeded.jpg", 456, 1]
    );

    const res = await harness.request(`/api/admin/galleries/${gallery.id}/permanent`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const galleryRow = await harness.env.DB.prepare("SELECT id FROM galleries WHERE id = ?").bind(gallery.id).first();
    const photoRow = await harness.env.DB.prepare("SELECT id FROM photos WHERE id = ?").bind(photoId).first();
    expect(galleryRow).toBeNull();
    expect(photoRow).toBeNull();
  });

  it("GET /users and POST /users/invite work and create admin log entry", async () => {
    await harness.runSql(
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, unixepoch(), unixepoch())",
      [crypto.randomUUID(), "Existing", "existing@example.com", 1]
    );

    const usersRes = await harness.request("/api/admin/users");
    expect(usersRes.status).toBe(200);
    const usersPayload = await usersRes.json() as { users: Array<{ email: string }> };
    expect(usersPayload.users.some((u) => u.email === "existing@example.com")).toBe(true);

    const inviteRes = await harness.request("/api/admin/users/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invitee@example.com", name: "Invitee" }),
    });
    expect(inviteRes.status).toBe(200);
    expect(mockSignUpEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const logRes = await harness.request("/api/admin/log");
    expect(logRes.status).toBe(200);
    const logPayload = await logRes.json() as { log: Array<{ event: string }> };
    expect(logPayload.log.some((entry) => entry.event === "USER_INVITED")).toBe(true);
  });
});
