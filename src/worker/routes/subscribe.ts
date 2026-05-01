import { Hono } from "hono";
import { Bindings } from "../index";
import { getDb } from "../lib/db";
import {
  confirmSubscription,
  subscribeToGallery,
  unsubscribeFromGallery,
} from "../services/subscriberService";
import { ServiceError } from "../services/types";
import type { TenantVariables } from "../middleware/tenant";

export const subscribeRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

// ------------------------------------------------------------------
// Subscribe to gallery notifications (double opt-in)
// ------------------------------------------------------------------
subscribeRoutes.post("/galleries/:slug", async (c) => {
  const { slug } = c.req.param();
  let body: { email?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await subscribeToGallery(ctx, {
      slug,
      tenantId: c.get("tenantId"),
      rawEmail: body.email,
      appOrigin: new URL(c.req.raw.url).origin,
    });
    return c.json({ ok: true, message: "Check your email to confirm subscription" });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// Confirm subscription
// ------------------------------------------------------------------
subscribeRoutes.get("/confirm", async (c) => {
  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await confirmSubscription(ctx, c.req.query("token"));
    return c.json({ ok: true, message: "Subscription confirmed" });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// Unsubscribe
// ------------------------------------------------------------------
subscribeRoutes.get("/unsubscribe", async (c) => {
  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await unsubscribeFromGallery(ctx, c.req.query("token"));
    return c.json({ ok: true, message: "Unsubscribed successfully" });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});