import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(async () => undefined),
}));

vi.mock("../../lib/email", async () => {
  const actual = await vi.importActual<typeof import("../../lib/email")>("../../lib/email");
  return {
    ...actual,
    sendEmail: mockSendEmail,
  };
});

let harness: WorkerTestHarness;

describe("subscribe routes", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
    mockSendEmail.mockClear();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("POST /api/subscribe/galleries/:slug inserts unverified row and sends confirmation email", async () => {
    const gallery = await harness.seedGallery({ slug: "sub-gallery", isPublic: true });

    const res = await harness.request(`/api/subscribe/galleries/${gallery.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fan@example.com" }),
    });

    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const row = await harness.env.DB.prepare(
      "SELECT email, verified, token FROM gallery_subscribers WHERE gallery_id = ? AND email = ?"
    ).bind(gallery.id, "fan@example.com").first<{ email: string; verified: number; token: string }>();

    expect(row?.email).toBe("fan@example.com");
    expect(row?.verified).toBe(0);
    expect(row?.token).toBeTruthy();
  });

  it("GET /api/subscribe/confirm verifies token and then returns 400 on re-confirm", async () => {
    const gallery = await harness.seedGallery({ slug: "confirm-gallery", isPublic: true });

    await harness.request(`/api/subscribe/galleries/${gallery.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "confirm@example.com" }),
    });

    const row = await harness.env.DB.prepare(
      "SELECT token FROM gallery_subscribers WHERE gallery_id = ? AND email = ?"
    ).bind(gallery.id, "confirm@example.com").first<{ token: string }>();

    expect(row?.token).toBeTruthy();

    const first = await harness.request(`/api/subscribe/confirm?token=${encodeURIComponent(row!.token)}`);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, message: "Subscription confirmed" });

    const second = await harness.request(`/api/subscribe/confirm?token=${encodeURIComponent(row!.token)}`);
    expect(second.status).toBe(400);
    expect(await second.json()).toEqual({ error: "Invalid or already confirmed token" });
  });

  it("GET /api/subscribe/unsubscribe deletes subscriber row", async () => {
    const gallery = await harness.seedGallery({ slug: "unsubscribe-gallery", isPublic: true });

    await harness.request(`/api/subscribe/galleries/${gallery.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "bye@example.com" }),
    });

    const row = await harness.env.DB.prepare(
      "SELECT token FROM gallery_subscribers WHERE gallery_id = ? AND email = ?"
    ).bind(gallery.id, "bye@example.com").first<{ token: string }>();

    const res = await harness.request(`/api/subscribe/unsubscribe?token=${encodeURIComponent(row!.token)}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: "Unsubscribed successfully" });

    const deleted = await harness.env.DB.prepare(
      "SELECT id FROM gallery_subscribers WHERE token = ?"
    ).bind(row!.token).first();

    expect(deleted).toBeNull();
  });
});
