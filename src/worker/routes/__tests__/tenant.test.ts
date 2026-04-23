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

describe("tenant middleware + scoped routes", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("GET /api/t/:tenantSlug/galleries returns 404 for unknown tenant", async () => {
    const res = await harness.request("/api/t/unknown-tenant/galleries");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Tenant not found" });
  });

  it("GET /api/t/:tenantSlug/galleries returns 404 for soft-deleted tenant", async () => {
    const tenant = await harness.seedTenant("deleted-tenant");
    await harness.runSql(
      "UPDATE tenants SET deleted_at = unixepoch() WHERE id = ?",
      [tenant.id]
    );
    const res = await harness.request("/api/t/deleted-tenant/galleries");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Tenant not found" });
  });

  it("GET /api/t/:tenantSlug/galleries returns only galleries belonging to that tenant", async () => {
    const tenantA = await harness.seedTenant("acme");
    const tenantB = await harness.seedTenant("other");

    await harness.seedGallery({ slug: "acme-gallery", isPublic: true, tenantId: tenantA.id });
    await harness.seedGallery({ slug: "other-gallery", isPublic: true, tenantId: tenantB.id });
    await harness.seedGallery({ slug: "no-tenant-gallery", isPublic: true });

    const res = await harness.request("/api/t/acme/galleries");
    expect(res.status).toBe(200);
    const { galleries } = await res.json() as { galleries: Array<{ slug: string }> };

    const slugs = galleries.map((g) => g.slug);
    expect(slugs).toContain("acme-gallery");
    expect(slugs).not.toContain("other-gallery");
    expect(slugs).not.toContain("no-tenant-gallery");
  });

  it("GET /api/t/:tenantSlug/galleries/:slug returns 404 for gallery in different tenant", async () => {
    const tenantA = await harness.seedTenant("tenant-a");
    const tenantB = await harness.seedTenant("tenant-b");

    await harness.seedGallery({ slug: "shared-slug", isPublic: true, tenantId: tenantB.id });

    // tenant-a should not be able to see tenant-b's gallery
    const res = await harness.request("/api/t/tenant-a/galleries/shared-slug");
    expect(res.status).toBe(404);
  });

  it("GET /api/t/:tenantSlug/galleries/:slug returns gallery for correct tenant", async () => {
    const tenant = await harness.seedTenant("myorg");
    await harness.seedGallery({ slug: "myorg-gallery", isPublic: true, tenantId: tenant.id });

    const res = await harness.request("/api/t/myorg/galleries/myorg-gallery");
    expect(res.status).toBe(200);
    const { gallery } = await res.json() as { gallery: { slug: string } };
    expect(gallery.slug).toBe("myorg-gallery");
  });

  it("POST /api/t/:tenantSlug/admin/galleries creates gallery with tenant_id set", async () => {
    const tenant = await harness.seedTenant("builder");

    const res = await harness.request("/api/t/builder/admin/galleries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Builder Gallery", slug: "builder-gallery", password: "pw1234" }),
    });
    expect(res.status).toBe(201);
    const { gallery } = await res.json() as { gallery: { id: string } };

    const row = await harness.env.DB.prepare(
      "SELECT tenant_id FROM galleries WHERE id = ?"
    ).bind(gallery.id).first<{ tenant_id: string }>();
    expect(row?.tenant_id).toBe(tenant.id);
  });

  it("POST /api/t/:tenantSlug/admin/galleries/:id/photos stores tenant-prefixed r2_key", async () => {
    const tenant = await harness.seedTenant("photos-org");
    const gallery = await harness.seedGallery({
      slug: "photos-org-gallery",
      isPublic: false,
      tenantId: tenant.id,
    });

    const body = new FormData();
    body.set("file", new File(["image"], "upload.jpg", { type: "image/jpeg" }));

    const originalBucket = harness.env.IMAGES_BUCKET;
    (harness.env as any).IMAGES_BUCKET = {
      ...originalBucket,
      put: vi.fn(async () => undefined),
    };

    const res = await harness.request(`/api/t/photos-org/admin/galleries/${gallery.id}/photos`, {
      method: "POST",
      body,
    });
    (harness.env as any).IMAGES_BUCKET = originalBucket;
    expect(res.status).toBe(201);

    const payload = (await res.json()) as { photo: { r2_key: string } };
    expect(payload.photo.r2_key.startsWith(`${tenant.id}/galleries/${gallery.id}/`)).toBe(true);
  });
});
