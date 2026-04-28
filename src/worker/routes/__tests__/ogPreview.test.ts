import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

let harness: WorkerTestHarness;

const FAKE_INDEX_HTML = `<!doctype html>
<html><head><title>Imago</title><meta name="description" content="default"></head>
<body><div id="root"></div></body></html>`;

function stubAssets(html: string = FAKE_INDEX_HTML, contentType: string = "text/html") {
  const original = harness.env.ASSETS;
  (harness.env as any).ASSETS = {
    fetch: async (req: Request) => {
      // Static assets (anything with a file extension that isn't .html)
      // get a non-html response so the rewriter passes them through.
      const url = new URL(req.url);
      if (/\.(css|js|png|jpg|svg|webp|ico)$/.test(url.pathname)) {
        return new Response("static", {
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response(html, {
        headers: { "content-type": contentType },
      });
    },
  };
  return () => {
    (harness.env as any).ASSETS = original;
  };
}

async function seedGallery(opts: {
  tenantSlug: string;
  tenantName?: string;
  gallerySlug: string;
  galleryName?: string;
  description?: string | null;
  isPublic: boolean;
  sharePreviewEnabled: boolean;
  withPhotos?: boolean;
  expiresAt?: number | null;
  deletedAt?: number | null;
}): Promise<{ tenantId: string; galleryId: string }> {
  const tenantId = crypto.randomUUID();
  await harness.runSql(
    "INSERT INTO tenants (id, slug, name, created_at) VALUES (?, ?, ?, unixepoch())",
    [tenantId, opts.tenantSlug, opts.tenantName ?? opts.tenantSlug]
  );

  const galleryId = crypto.randomUUID();
  await harness.runSql(
    `INSERT INTO galleries
       (id, tenant_id, name, slug, password_hash, description, is_public, share_preview_enabled, expires_at, deleted_at, created_at)
     VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, unixepoch())`,
    [
      galleryId,
      tenantId,
      opts.galleryName ?? `Gallery ${opts.gallerySlug}`,
      opts.gallerySlug,
      opts.description ?? null,
      opts.isPublic ? 1 : 0,
      opts.sharePreviewEnabled ? 1 : 0,
      opts.expiresAt ?? null,
      opts.deletedAt ?? null,
    ]
  );

  if (opts.withPhotos) {
    const photoId = crypto.randomUUID();
    await harness.runSql(
      "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, unixepoch(), ?)",
      [photoId, galleryId, `${tenantId}/${photoId}`, "p.jpg", 1, 0]
    );
  }

  return { tenantId, galleryId };
}

describe("og preview HTML rewriter", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("injects per-gallery OG meta tags for a public gallery with photos", async () => {
    await seedGallery({
      tenantSlug: "acme",
      tenantName: "Acme Studio",
      gallerySlug: "wedding",
      galleryName: "Smith Wedding",
      description: "A sunny day in the park.",
      isPublic: true,
      sharePreviewEnabled: true,
      withPhotos: true,
    });

    const restore = stubAssets();
    const res = await harness.request("/acme/wedding");
    restore();

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<title>Smith Wedding — Acme Studio</title>');
    expect(html).toContain('property="og:title"');
    expect(html).toContain("Smith Wedding — Acme Studio");
    expect(html).toContain('property="og:description"');
    expect(html).toContain("A sunny day in the park.");
    expect(html).toContain('property="og:image"');
    expect(html).toContain("/api/og/acme/wedding/image");
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("omits og:image when the gallery has no photos", async () => {
    await seedGallery({
      tenantSlug: "acme",
      gallerySlug: "empty",
      isPublic: true,
      sharePreviewEnabled: true,
      withPhotos: false,
    });

    const restore = stubAssets();
    const res = await harness.request("/acme/empty");
    restore();

    const html = await res.text();
    expect(html).not.toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).toContain('property="og:title"');
  });

  it("passes through the index.html unchanged for a private gallery without share_preview_enabled", async () => {
    await seedGallery({
      tenantSlug: "acme",
      gallerySlug: "private",
      isPublic: false,
      sharePreviewEnabled: false,
      withPhotos: true,
    });

    const restore = stubAssets();
    const res = await harness.request("/acme/private");
    restore();

    const html = await res.text();
    expect(html).not.toContain("Gallery private");
    expect(html).not.toContain("og:title");
    // Default index.html title is preserved
    expect(html).toContain("<title>Imago</title>");
  });

  it("injects preview for a private gallery when share_preview_enabled is true", async () => {
    await seedGallery({
      tenantSlug: "acme",
      gallerySlug: "private-shared",
      galleryName: "Internal Review",
      isPublic: false,
      sharePreviewEnabled: true,
      withPhotos: true,
    });

    const restore = stubAssets();
    const res = await harness.request("/acme/private-shared");
    restore();

    const html = await res.text();
    expect(html).toContain("Internal Review");
    expect(html).toContain('property="og:image"');
  });

  it("passes through deleted galleries", async () => {
    await seedGallery({
      tenantSlug: "acme",
      gallerySlug: "deleted",
      isPublic: true,
      sharePreviewEnabled: true,
      withPhotos: true,
      deletedAt: Math.floor(Date.now() / 1000),
    });

    const restore = stubAssets();
    const res = await harness.request("/acme/deleted");
    restore();

    const html = await res.text();
    expect(html).not.toContain("Gallery deleted");
    expect(html).toContain("<title>Imago</title>");
  });

  it("passes through expired galleries", async () => {
    await seedGallery({
      tenantSlug: "acme",
      gallerySlug: "expired",
      isPublic: true,
      sharePreviewEnabled: true,
      withPhotos: true,
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    });

    const restore = stubAssets();
    const res = await harness.request("/acme/expired");
    restore();

    const html = await res.text();
    expect(html).toContain("<title>Imago</title>");
    expect(html).not.toContain("og:title");
  });

  it("passes through the /:tenantSlug/:gallerySlug/login subpath", async () => {
    await seedGallery({
      tenantSlug: "acme",
      gallerySlug: "wedding",
      galleryName: "Smith Wedding",
      isPublic: false,
      sharePreviewEnabled: true,
      withPhotos: true,
    });

    const restore = stubAssets();
    const res = await harness.request("/acme/wedding/login");
    restore();

    const html = await res.text();
    expect(html).toContain("<title>Imago</title>");
    expect(html).not.toContain("og:title");
  });

  it("passes through tenant index pages", async () => {
    await seedGallery({
      tenantSlug: "acme",
      gallerySlug: "wedding",
      isPublic: true,
      sharePreviewEnabled: true,
      withPhotos: true,
    });

    const restore = stubAssets();
    const res = await harness.request("/acme");
    restore();

    const html = await res.text();
    expect(html).toContain("<title>Imago</title>");
  });

  it("passes through static asset requests untouched", async () => {
    const restore = stubAssets();
    const res = await harness.request("/main.js");
    restore();

    expect(await res.text()).toBe("static");
  });
});
