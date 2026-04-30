import { Hono } from "hono";
import { Bindings } from "../index";
import { auth } from "../lib/auth";
import { IMAGO_ORG_SLUG, ROLES } from "../lib/roles";

export const loginRoutes = new Hono<{ Bindings: Bindings }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns true if the user is a member of the platform `imago` org with role
 * `imago_operator`. Replaces the legacy `user.is_super_admin` flag (removed
 * in migration 0011).
 */
async function isImagoOperator(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM member m
     INNER JOIN organization o ON o.id = m.organizationId
     WHERE m.userId = ? AND o.slug = ? AND m.role = ?
     LIMIT 1`
  ).bind(userId, IMAGO_ORG_SLUG, ROLES.IMAGO_OPERATOR).first();
  return !!row;
}

// ------------------------------------------------------------------
// Universal login: magic-link request
// Sends a link only when the email is a super-admin OR has at least one
// active tenant membership. Always returns { ok: true } (no enumeration).
// Callback lands the user on /login/resolve which routes them to the
// highest-privilege dashboard available.
// ------------------------------------------------------------------
loginRoutes.post("/magic-link", async (c) => {
  const body = await c.req
    .json<{ email?: string }>()
    .catch(() => ({} as { email?: string }));
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM user WHERE lower(email) = ?"
  )
    .bind(email)
    .first<{ id: string }>();

  let shouldSend = false;
  if (user) {
    if (await isImagoOperator(c.env.DB, user.id)) {
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
