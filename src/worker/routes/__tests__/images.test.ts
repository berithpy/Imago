import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn<() => Promise<{ user: { email: string } } | null>>(async () => null),
}));

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(() => ({
    api: {
      getSession: mockGetSession,
    },
  })),
}));

let harness: WorkerTestHarness;

describe("image routes", () => {
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

  it("returns 401 when no admin session or viewer token is present", async () => {
    const res = await harness.request("/api/images/some/key.jpg?variant=full");
    expect(res.status).toBe(401);
  });

  it("returns 404 for missing object when authorized", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { email: "admin@example.com" } });

    const res = await harness.request("/api/images/missing/key.jpg?variant=full");
    expect(res.status).toBe(404);
  });

  it("serves full variant from R2 when authorized", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { email: "admin@example.com" } });

    const key = "gallery/test-image.jpg";
    const content = "binary-image-content";
    const originalBucket = harness.env.IMAGES_BUCKET;
    (harness.env as any).IMAGES_BUCKET = {
      get: async (requestedKey: string) => {
        if (requestedKey !== key) return null;
        return {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(content));
              controller.close();
            },
          }),
          httpEtag: "\"test-etag\"",
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", "image/jpeg");
          },
        };
      },
    };

    const res = await harness.request(`/api/images/${encodeURIComponent(key)}?variant=full`);
    (harness.env as any).IMAGES_BUCKET = originalBucket;

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=86400");
    expect(res.headers.get("content-type") ?? "").toContain("image/jpeg");
    expect(await res.text()).toBe(content);
  });

  it("serves transformed variant using IMAGES binding", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { email: "admin@example.com" } });

    const key = "gallery/transform-image.jpg";
    const originalBucket = harness.env.IMAGES_BUCKET;
    const originalImages = harness.env.IMAGES;

    (harness.env as any).IMAGES_BUCKET = {
      get: async (requestedKey: string) => {
        if (requestedKey !== key) return null;
        return {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("source"));
              controller.close();
            },
          }),
          httpEtag: "\"etag\"",
          writeHttpMetadata(_headers: Headers) {
            // not used for successful transform path
          },
        };
      },
    };

    (harness.env as any).IMAGES = {
      input: () => ({
        transform: () => ({
          output: () => ({
            response: () =>
              new Response("webp-content", {
                headers: { "content-type": "image/webp" },
              }),
          }),
        }),
      }),
    };

    const res = await harness.request(`/api/images/${encodeURIComponent(key)}?variant=thumb`);
    (harness.env as any).IMAGES_BUCKET = originalBucket;
    (harness.env as any).IMAGES = originalImages;

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("image/webp");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=86400");
    expect(await res.text()).toBe("webp-content");
  });

  it("returns 404 when viewer token tenant does not match key prefix", async () => {
    const tenantA = await harness.seedTenant("tenant-a");
    const tenantB = await harness.seedTenant("tenant-b");
    const galleryA = await harness.seedGallery({ slug: "tenant-a-gallery", isPublic: false, tenantId: tenantA.id });

    const loginRes = await harness.request(`/api/t/tenant-a/viewer/gallery/${galleryA.slug}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: galleryA.password }),
    });
    expect(loginRes.status).toBe(200);

    const cookie = loginRes.headers.get("set-cookie") ?? "";
    const key = `${tenantB.id}/galleries/${galleryA.id}/cross-tenant.jpg`;
    const originalBucket = harness.env.IMAGES_BUCKET;
    (harness.env as any).IMAGES_BUCKET = {
      get: async () => ({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("image"));
            controller.close();
          },
        }),
        httpEtag: "\"etag\"",
        writeHttpMetadata(headers: Headers) {
          headers.set("content-type", "image/jpeg");
        },
      }),
    };

    const res = await harness.request(`/api/images/${encodeURIComponent(key)}?variant=full`, {
      headers: { cookie },
    });
    (harness.env as any).IMAGES_BUCKET = originalBucket;

    expect(res.status).toBe(404);
  });

  it("serves image when viewer token tenant matches key prefix", async () => {
    const tenant = await harness.seedTenant("tenant-match");
    const gallery = await harness.seedGallery({ slug: "tenant-match-gallery", isPublic: false, tenantId: tenant.id });

    const loginRes = await harness.request(`/api/t/tenant-match/viewer/gallery/${gallery.slug}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: gallery.password }),
    });
    expect(loginRes.status).toBe(200);

    const cookie = loginRes.headers.get("set-cookie") ?? "";
    const key = `${tenant.id}/galleries/${gallery.id}/match.jpg`;
    const originalBucket = harness.env.IMAGES_BUCKET;
    (harness.env as any).IMAGES_BUCKET = {
      get: async (requestedKey: string) => {
        if (requestedKey !== key) return null;
        return {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("ok-image"));
              controller.close();
            },
          }),
          httpEtag: "\"etag\"",
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", "image/jpeg");
          },
        };
      },
    };

    const res = await harness.request(`/api/images/${encodeURIComponent(key)}?variant=full`, {
      headers: { cookie },
    });
    (harness.env as any).IMAGES_BUCKET = originalBucket;

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok-image");
  });
});
