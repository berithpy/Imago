import { Hono } from "hono";
import { Bindings } from "../index";
import { getDb } from "../lib/db";
import { recordInterest } from "../services/subscriberService";
import { ServiceError } from "../services/types";

export const interestRoutes = new Hono<{ Bindings: Bindings }>();

// ------------------------------------------------------------------
// POST /api/interest
// Public landing-page waitlist capture. Idempotent on duplicate email.
// ------------------------------------------------------------------
interestRoutes.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    const result = await recordInterest(ctx, (body as { email?: unknown })?.email);
    return c.json(result.alreadyRegistered ? { ok: true, alreadyRegistered: true } : { ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});
