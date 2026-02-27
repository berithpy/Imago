import { Hono } from "hono";
import { Bindings } from "../index";

export const subscribeRoutes = new Hono<{ Bindings: Bindings }>();

// ------------------------------------------------------------------
// Subscribe to gallery notifications (double opt-in)
// ------------------------------------------------------------------
subscribeRoutes.post("/galleries/:slug", async (c) => {
  const { slug } = c.req.param();
  const { email } = await c.req.json<{ email: string }>();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const gallery = await c.env.DB.prepare(
    "SELECT id, name FROM galleries WHERE slug = ?"
  )
    .bind(slug)
    .first<{ id: string; name: string }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const token = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Upsert: ignore if already subscribed
  await c.env.DB.prepare(
    `INSERT INTO gallery_subscribers (id, gallery_id, email, token, verified, created_at)
		 VALUES (?, ?, ?, ?, 0, ?)
		 ON CONFLICT(gallery_id, email) DO NOTHING`
  )
    .bind(crypto.randomUUID(), gallery.id, email, token, now)
    .run();

  // TODO (Stage 5): Send confirmation email via Resend
  // await sendConfirmationEmail(c.env.RESEND_API_KEY, email, gallery.name, token);

  return c.json({ ok: true, message: "Check your email to confirm subscription" });
});

// ------------------------------------------------------------------
// Confirm subscription
// ------------------------------------------------------------------
subscribeRoutes.get("/confirm", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Token required" }, 400);

  const result = await c.env.DB.prepare(
    "UPDATE gallery_subscribers SET verified = 1 WHERE token = ? AND verified = 0"
  )
    .bind(token)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Invalid or already confirmed token" }, 400);
  }

  return c.json({ ok: true, message: "Subscription confirmed" });
});

// ------------------------------------------------------------------
// Unsubscribe
// ------------------------------------------------------------------
subscribeRoutes.get("/unsubscribe", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Token required" }, 400);

  await c.env.DB.prepare(
    "DELETE FROM gallery_subscribers WHERE token = ?"
  )
    .bind(token)
    .run();

  return c.json({ ok: true, message: "Unsubscribed successfully" });
});
