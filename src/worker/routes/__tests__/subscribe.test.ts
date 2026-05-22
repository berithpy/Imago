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

  it("GET /api/subscribe/confirm returns 400 when token is missing", async () => {
    const res = await harness.request("/api/subscribe/confirm");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Token required" });
  });

  it("GET /api/subscribe/unsubscribe returns 400 when token is missing", async () => {
    const res = await harness.request("/api/subscribe/unsubscribe");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Token required" });
  });

  it("GET /api/subscribe/confirm sends a subscription confirmed email", async () => {
    const gallery = await harness.seedGallery({ slug: "email-confirm-gallery", isPublic: true });

    await harness.request(`/api/subscribe/galleries/${gallery.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "email-confirm@example.com" }),
    });
    mockSendEmail.mockClear();

    const row = await harness.env.DB.prepare(
      "SELECT token FROM gallery_subscribers WHERE gallery_id = ? AND email = ?"
    ).bind(gallery.id, "email-confirm@example.com").first<{ token: string }>();

    await harness.request(`/api/subscribe/confirm?token=${encodeURIComponent(row!.token)}`);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ to: "email-confirm@example.com" })
    );
  });

  it("GET /api/subscribe/unsubscribe sends an unsubscribe confirmation email", async () => {
    const gallery = await harness.seedGallery({ slug: "email-unsub-gallery", isPublic: true });

    await harness.request(`/api/subscribe/galleries/${gallery.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "unsub-email@example.com" }),
    });
    mockSendEmail.mockClear();

    const row = await harness.env.DB.prepare(
      "SELECT token FROM gallery_subscribers WHERE gallery_id = ? AND email = ?"
    ).bind(gallery.id, "unsub-email@example.com").first<{ token: string }>();

    await harness.request(`/api/subscribe/unsubscribe?token=${encodeURIComponent(row!.token)}`);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ to: "unsub-email@example.com" })
    );
  });

  it("POST /api/subscribe/galleries/:slug returns 400 for invalid email", async () => {
    const gallery = await harness.seedGallery({ slug: "invalid-email-gallery", isPublic: true });
    const res = await harness.request(`/api/subscribe/galleries/${gallery.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("email") });
  });

  it("POST /api/subscribe/galleries/:slug returns 404 for unknown gallery", async () => {
    const res = await harness.request("/api/subscribe/galleries/unknown-gallery-slug", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fan@example.com" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/subscribe/galleries/:slug resends existing token if already subscribed", async () => {
    const gallery = await harness.seedGallery({ slug: "resend-gallery", isPublic: true });

    await harness.request(`/api/subscribe/galleries/${gallery.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "repeat@example.com" }),
    });
    const row1 = await harness.env.DB.prepare(
      "SELECT token FROM gallery_subscribers WHERE gallery_id = ? AND email = ?"
    ).bind(gallery.id, "repeat@example.com").first<{ token: string }>();

    mockSendEmail.mockClear();

    await harness.request(`/api/subscribe/galleries/${gallery.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "repeat@example.com" }),
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const row2 = await harness.env.DB.prepare(
      "SELECT token FROM gallery_subscribers WHERE gallery_id = ? AND email = ?"
    ).bind(gallery.id, "repeat@example.com").first<{ token: string }>();
    expect(row2?.token).toBe(row1?.token);
  });
});
