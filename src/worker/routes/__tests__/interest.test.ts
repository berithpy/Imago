import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createWorkerTestHarness, type WorkerTestHarness } from "./testHarness";

let harness: WorkerTestHarness;

describe("interest routes", () => {
  beforeAll(async () => {
    harness = await createWorkerTestHarness();
  });

  beforeEach(async () => {
    await harness.resetDb();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it("POST /api/interest inserts a row and returns ok", async () => {
    const res = await harness.request("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "photographer@example.com" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const row = await harness.env.DB.prepare(
      "SELECT email, source FROM interest_signups WHERE email = ?"
    ).bind("photographer@example.com").first<{ email: string; source: string }>();

    expect(row?.email).toBe("photographer@example.com");
    expect(row?.source).toBe("landing");
  });

  it("normalizes email (trim + lowercase) before storing", async () => {
    const res = await harness.request("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "  Mixed.Case@Example.COM  " }),
    });

    expect(res.status).toBe(200);

    const row = await harness.env.DB.prepare(
      "SELECT email FROM interest_signups WHERE email = ?"
    ).bind("mixed.case@example.com").first<{ email: string }>();

    expect(row?.email).toBe("mixed.case@example.com");
  });

  it("is idempotent on duplicate email and signals alreadyRegistered", async () => {
    const body = JSON.stringify({ email: "dup@example.com" });
    const opts = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    } as const;

    const first = await harness.request("/api/interest", opts);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });

    const second = await harness.request("/api/interest", opts);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, alreadyRegistered: true });

    const count = await harness.env.DB.prepare(
      "SELECT COUNT(*) as n FROM interest_signups WHERE email = ?"
    ).bind("dup@example.com").first<{ n: number }>();

    expect(count?.n).toBe(1);
  });

  it("rejects malformed email with 400", async () => {
    const res = await harness.request("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects missing email field with 400", async () => {
    const res = await harness.request("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await harness.request("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
  });
});
