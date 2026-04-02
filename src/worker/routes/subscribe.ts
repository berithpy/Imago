import { Hono } from "hono";
import { Bindings } from "../index";
import {
  sendEmail,
  subscriptionConfirmationHtml,
  subscriptionConfirmedHtml,
  unsubscribeConfirmedHtml,
} from "../lib/email";

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

  // Upsert: ignore if already subscribed — but fetch the token we'll use for the email
  const existingRow = await c.env.DB.prepare(
    "SELECT token FROM gallery_subscribers WHERE gallery_id = ? AND email = ?"
  ).bind(gallery.id, email).first<{ token: string }>();

  let confirmToken: string = token;
  if (existingRow) {
    confirmToken = existingRow.token;
  } else {
    await c.env.DB.prepare(
      `INSERT INTO gallery_subscribers (id, gallery_id, email, token, verified, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`
    ).bind(crypto.randomUUID(), gallery.id, email, token, now).run();
  }

  const origin = new URL(c.req.raw.url).origin;
  const confirmUrl = `${origin}/api/subscribe/confirm?token=${encodeURIComponent(confirmToken)}`;
  await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, {
    to: email,
    subject: `Confirm your subscription to ${gallery.name}`,
    html: subscriptionConfirmationHtml(gallery.name, confirmUrl),
  });

  return c.json({ ok: true, message: "Check your email to confirm subscription" });
});

// ------------------------------------------------------------------
// Confirm subscription
// ------------------------------------------------------------------
subscribeRoutes.get("/confirm", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Token required" }, 400);

  // Fetch subscriber info before updating so we can send the confirmation email
  const subscriber = await c.env.DB.prepare(
    `SELECT gs.email, g.name AS gallery_name
     FROM gallery_subscribers gs
     JOIN galleries g ON g.id = gs.gallery_id
     WHERE gs.token = ? AND gs.verified = 0`
  ).bind(token).first<{ email: string; gallery_name: string }>();

  const result = await c.env.DB.prepare(
    "UPDATE gallery_subscribers SET verified = 1 WHERE token = ? AND verified = 0"
  )
    .bind(token)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Invalid or already confirmed token" }, 400);
  }

  if (subscriber) {
    await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, {
      to: subscriber.email,
      subject: `You're subscribed to ${subscriber.gallery_name}`,
      html: subscriptionConfirmedHtml(subscriber.gallery_name),
    });
  }

  return c.json({ ok: true, message: "Subscription confirmed" });
});

// ------------------------------------------------------------------
// Unsubscribe
// ------------------------------------------------------------------
subscribeRoutes.get("/unsubscribe", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Token required" }, 400);

  // Fetch subscriber info before deleting so we can send the confirmation email
  const subscriber = await c.env.DB.prepare(
    `SELECT gs.email, g.name AS gallery_name
     FROM gallery_subscribers gs
     JOIN galleries g ON g.id = gs.gallery_id
     WHERE gs.token = ?`
  ).bind(token).first<{ email: string; gallery_name: string }>();

  await c.env.DB.prepare(
    "DELETE FROM gallery_subscribers WHERE token = ?"
  )
    .bind(token)
    .run();

  if (subscriber) {
    await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, {
      to: subscriber.email,
      subject: `Unsubscribed from ${subscriber.gallery_name}`,
      html: unsubscribeConfirmedHtml(subscriber.gallery_name),
    });
  }

  return c.json({ ok: true, message: "Unsubscribed successfully" });
});
