import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

let harness: WorkerTestHarness;

async function seedGalleryWithBanner(opts: {
  tenantSlug: string;
  gallerySlug: string;
  isPublic: boolean;
  sharePreviewEnabled: boolean;
  withBanner: boolean;
  withPhotos?: boolean;
  expiresAt?: number | null;
  deletedAt?: number | null;
}): Promise<{ tenantId: string; galleryId: string; r2Key: string | null }> {
  const tenant = await harness.seedTenant(opts.tenantSlug);
  const gallery = await harness.seedGallery({
    slug: opts.gallerySlug,
    isPublic: opts.isPublic,
    tenantId: tenant.id,
  });

  await harness.runSql(
    "UPDATE galleries SET share_preview_enabled = ?, expires_at = ?, deleted_at = ? WHERE id = ?",
    [
      opts.sharePreviewEnabled ? 1 : 0,
      opts.expiresAt ?? null,
      opts.deletedAt ?? null,
      gallery.id,
    ]
  );

  let r2Key: string | null = null;
  if (opts.withPhotos || opts.withBanner) {
    const photoId = crypto.randomUUID();
    r2Key = `${tenant.id}/${photoId}`;
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, gallery.id, r2Key, "banner.jpg", 1024, 0]
    );
    if (opts.withBanner) {
      await harness.runSql(
        "UPDATE galleries SET banner_photo_id = ? WHERE id = ?",
        [photoId, gallery.id]
      );
    }
  }

  return { tenantId: tenant.id, galleryId: gallery.id, r2Key };
}

function stubBucket(r2Key: string) {
  const original = harness.env.IMAGES_BUCKET;
  (harness.env as any).IMAGES_BUCKET = {
    get: async (key: string) => {
      if (key !== r2Key) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("img-bytes"));
            controller.close();
          },
        }),
        httpEtag: '"etag"',
        writeHttpMetadata(headers: Headers) {
          headers.set("content-type", "image/jpeg");
        },
      };
    },
  };
  return () => {
    (harness.env as any).IMAGES_BUCKET = original;
  };
}

function stubImagesBinding() {
  const original = harness.env.IMAGES;
  (harness.env as any).IMAGES = {
    input: () => ({
      transform: () => ({
        output: () => ({
          response: () =>
            new Response("webp-bytes", {
              headers: { "content-type": "image/webp" },
            }),
        }),
      }),
    }),
  };
  return () => {
    (harness.env as any).IMAGES = original;
  };
}

describe("og image route", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("serves a transformed webp for a public gallery with a banner", async () => {
    const seed = await seedGalleryWithBanner({
      tenantSlug: "acme",
      gallerySlug: "wedding",
      isPublic: true,
      sharePreviewEnabled: true,
      withBanner: true,
    });

    const restoreBucket = stubBucket(seed.r2Key!);
    const restoreImages = stubImagesBinding();

    const res = await harness.request("/api/og/acme/wedding/image");

    restoreBucket();
    restoreImages();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(res.headers.get("content-type") ?? "").toContain("image/webp");
  });

  it("falls back to first photo when banner is unset", async () => {
    const seed = await seedGalleryWithBanner({
      tenantSlug: "acme",
      gallerySlug: "no-banner",
      isPublic: true,
      sharePreviewEnabled: true,
      withBanner: false,
      withPhotos: true,
    });

    const restoreBucket = stubBucket(seed.r2Key!);
    const restoreImages = stubImagesBinding();

    const res = await harness.request("/api/og/acme/no-banner/image");

    restoreBucket();
    restoreImages();

    expect(res.status).toBe(200);
  });

  it("returns 404 when the gallery has no photos", async () => {
    await seedGalleryWithBanner({
      tenantSlug: "acme",
      gallerySlug: "empty",
      isPublic: true,
      sharePreviewEnabled: true,
      withBanner: false,
      withPhotos: false,
    });

    const res = await harness.request("/api/og/acme/empty/image");
    expect(res.status).toBe(404);
  });

  it("returns 404 when share_preview_enabled is false (private gallery, no leak)", async () => {
    await seedGalleryWithBanner({
      tenantSlug: "acme",
      gallerySlug: "private",
      isPublic: false,
      sharePreviewEnabled: false,
      withBanner: true,
    });

    const res = await harness.request("/api/og/acme/private/image");
    expect(res.status).toBe(404);
  });

  it("serves a thumbnail for a private gallery when share_preview_enabled is true", async () => {
    const seed = await seedGalleryWithBanner({
      tenantSlug: "acme",
      gallerySlug: "private-shared",
      isPublic: false,
      sharePreviewEnabled: true,
      withBanner: true,
    });

    const restoreBucket = stubBucket(seed.r2Key!);
    const restoreImages = stubImagesBinding();

    const res = await harness.request("/api/og/acme/private-shared/image");

    restoreBucket();
    restoreImages();

    expect(res.status).toBe(200);
  });

  it("returns 404 for deleted galleries", async () => {
    await seedGalleryWithBanner({
      tenantSlug: "acme",
      gallerySlug: "deleted",
      isPublic: true,
      sharePreviewEnabled: true,
      withBanner: true,
      deletedAt: Math.floor(Date.now() / 1000),
    });

    const res = await harness.request("/api/og/acme/deleted/image");
    expect(res.status).toBe(404);
  });

  it("returns 404 for expired galleries", async () => {
    await seedGalleryWithBanner({
      tenantSlug: "acme",
      gallerySlug: "expired",
      isPublic: true,
      sharePreviewEnabled: true,
      withBanner: true,
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    });

    const res = await harness.request("/api/og/acme/expired/image");
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown tenant or gallery", async () => {
    const res1 = await harness.request("/api/og/nonexistent/whatever/image");
    expect(res1.status).toBe(404);

    await seedGalleryWithBanner({
      tenantSlug: "acme",
      gallerySlug: "real",
      isPublic: true,
      sharePreviewEnabled: true,
      withBanner: true,
    });

    const res2 = await harness.request("/api/og/acme/missing/image");
    expect(res2.status).toBe(404);
  });
});
