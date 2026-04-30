import { Hono } from "hono";
import { Bindings } from "../index";
import { auth } from "../lib/auth";

export const loginRoutes = new Hono<{ Bindings: Bindings }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------------
// Universal login: magic-link request
// Sends a link only when the email is a super-admin OR has at least one
// active tenant membership. Always returns { ok: true } (no enumeration).
// Callback lands the user on /login/resolve which routes them to the
// highest-privilege dashboard available.
// ------------------------------------------------------------------
loginRoutes.post("/magic-link", async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({}));
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, is_super_admin FROM user WHERE lower(email) = ?"
  )
    .bind(email)
    .first<{ id: string; is_super_admin: number }>();

  let shouldSend = false;
  if (user) {
    if (user.is_super_admin) {
      shouldSend = true;
    } else {
      // Check for at least one membership in a non-deleted tenant.
      const member = await c.env.DB.prepare(
        `SELECT m.id
         FROM member m
         INNER JOIN tenants t ON t.organization_id = m.organizationId
         WHERE m.userId = ? AND t.deleted_at IS NULL
         LIMIT 1`
      )
        .bind(user.id)
        .first();
      if (member) shouldSend = true;
    }
  }

  if (shouldSend) {
    const origin = new URL(c.req.raw.url).origin;
    try {
      await auth(c.env, origin).api.signInMagicLink({
        body: { email, callbackURL: "/login/resolve" },
        headers: c.req.raw.headers,
      });
    } catch (err) {
      console.error("[login/magic-link] Failed to send magic link:", err);
    }
  }

  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Universal login: resolve destinations for the signed-in user.
// Returns { superAdmin, tenants[] } — the SPA picks the destination.
// ------------------------------------------------------------------
loginRoutes.get("/resolve", async (c) => {
  const origin = new URL(c.req.raw.url).origin;
  const session = await auth(c.env, origin).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const email = session.user.email;
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare(
    "SELECT id, is_super_admin FROM user WHERE lower(email) = ?"
  )
    .bind(email.toLowerCase())
    .first<{ id: string; is_super_admin: number }>();

  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT t.slug AS slug, t.name AS name
     FROM member m
     INNER JOIN tenants t ON t.organization_id = m.organizationId
     WHERE m.userId = ? AND t.deleted_at IS NULL
     ORDER BY t.name ASC`
  )
    .bind(user.id)
    .all<{ slug: string; name: string }>();

  return c.json({
    superAdmin: !!user.is_super_admin,
    tenants: results,
  });
});
