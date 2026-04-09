import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(async () => null),
}));

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      getSession: mockGetSession,
    },
  })),
}));

let harness: WorkerTestHarness;

describe("gallery routes", () => {
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

  it("GET /api/galleries/:slug/photos supports pagination and returns total count", async () => {
    const gallery = await harness.seedGallery({ slug: "paged-gallery", isPublic: false, password: "photos-pass" });

    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [crypto.randomUUID(), gallery.id, "g1/a.jpg", "a.jpg", 101, 1]
    );
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [crypto.randomUUID(), gallery.id, "g1/b.jpg", "b.jpg", 102, 2]
    );
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [crypto.randomUUID(), gallery.id, "g1/c.jpg", "c.jpg", 103, 3]
    );

    const loginRes = await harness.request(`/api/viewer/gallery/${gallery.slug}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "photos-pass" }),
    });
    expect(loginRes.status).toBe(200);

    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const page1Res = await harness.request(`/api/galleries/${gallery.slug}/photos?limit=2`, {
      headers: { cookie },
    });
    expect(page1Res.status).toBe(200);
    const page1 = await page1Res.json() as {
      photos: Array<{ original_name: string }>;
      nextCursor: string | null;
      total: number;
    };

    expect(page1.total).toBe(3);
    expect(page1.photos).toHaveLength(2);
    expect(page1.nextCursor).toBe("2");

    const page2Res = await harness.request(`/api/galleries/${gallery.slug}/photos?limit=2&cursor=${page1.nextCursor ?? ""}`, {
      headers: { cookie },
    });
    expect(page2Res.status).toBe(200);
    const page2 = await page2Res.json() as {
      photos: Array<{ original_name: string }>;
      nextCursor: string | null;
      total: number;
    };

    expect(page2.total).toBe(3);
    expect(page2.photos).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });

  it("GET /api/galleries/:slug returns 410 when gallery is expired", async () => {
    const now = Math.floor(Date.now() / 1000);
    const password = "expired-pass";
    const expiredHash = await (await import("../../lib/crypto")).pbkdf2Hash(password);
    const slug = "expired-gallery";

    await harness.runSql(
      "INSERT INTO galleries (id, name, slug, password_hash, is_public, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, unixepoch())",
      [crypto.randomUUID(), "Expired", slug, expiredHash, 1, now - 60]
    );

    const res = await harness.request(`/api/galleries/${slug}`);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "This gallery has expired" });
  });

  it("private protected gallery endpoints return 401 when unauthenticated", async () => {
    const gallery = await harness.seedGallery({ slug: "private-protected", isPublic: false, password: "pw1234" });
    const photoId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, gallery.id, `galleries/${gallery.id}/${photoId}.jpg`, "private.jpg", 120, 1]
    );

    const exportRes = await harness.request(`/api/galleries/${gallery.slug}/export`);
    expect(exportRes.status).toBe(401);
    expect(await exportRes.json()).toEqual({ error: "Unauthorized" });

    const singlePhotoRes = await harness.request(`/api/galleries/${gallery.slug}/photos/${photoId}`);
    expect(singlePhotoRes.status).toBe(401);
    expect(await singlePhotoRes.json()).toEqual({ error: "Unauthorized" });
  });
});
