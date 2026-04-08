import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { Bindings } from "../index";
import { pbkdf2Verify } from "../lib/crypto";
import { auth } from "../lib/auth";
import { logAdminEvent } from "../lib/adminLog";

export const viewerRoutes = new Hono<{ Bindings: Bindings }>();

// ------------------------------------------------------------------
// Viewer: unlock a gallery with its password
// ------------------------------------------------------------------
viewerRoutes.post("/gallery/:slug/login", async (c) => {
  const { slug } = c.req.param();
  const body = await c.req.json<{ password?: string }>();

  const gallery = await c.env.DB.prepare(
    "SELECT id, password_hash, is_public, name FROM galleries WHERE slug = ? AND deleted_at IS NULL"
  )
    .bind(slug)
    .first<{ id: string; password_hash: string; is_public: number; name: string }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  // Public galleries: skip password check entirely
  if (!gallery.is_public) {
    if (!body.password) return c.json({ error: "Password required" }, 400);
    const valid = await pbkdf2Verify(body.password, gallery.password_hash);
    if (!valid) return c.json({ error: "Invalid password" }, 401);
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24h
  const token = await sign(
    { sub: "viewer", galleryId: gallery.id, exp },
    c.env.JWT_SECRET
  );

  setCookie(c, "viewer_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Viewer: request a magic link (email must be on the gallery whitelist)
// ------------------------------------------------------------------
viewerRoutes.post("/gallery/:slug/magic-link", async (c) => {
  const { slug } = c.req.param();
  const { email, callbackPath } = await c.req.json<{ email: string; callbackPath?: string }>();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const gallery = await c.env.DB.prepare(
    "SELECT id, name FROM galleries WHERE slug = ? AND deleted_at IS NULL"
  ).bind(slug).first<{ id: string; name: string }>();
  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const normalised = email.trim().toLowerCase();
  const allowed = await c.env.DB.prepare(
    "SELECT id FROM gallery_allowed_emails WHERE gallery_id = ? AND lower(email) = ?"
  ).bind(gallery.id, normalised).first();
  if (!allowed) return c.json({ error: "Email not on access list" }, 403);

  const defaultCallback = `/gallery/${slug}`;
  const safeCallback =
    callbackPath && callbackPath.startsWith(defaultCallback) && !callbackPath.startsWith("//")
      ? callbackPath
      : defaultCallback;

  const origin = new URL(c.req.raw.url).origin;
  await auth(c.env, origin).api.signInMagicLink({
    body: {
      email: normalised,
      callbackURL: safeCallback,
    },
    headers: c.req.raw.headers,
  });

  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Viewer: logout (clear viewer cookie)
// ------------------------------------------------------------------
viewerRoutes.post("/gallery/logout", (c) => {
  deleteCookie(c, "viewer_token", { path: "/" });
  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Admin: emergency reset — clears admin session cookie
// ------------------------------------------------------------------
viewerRoutes.post("/admin/reset", async (c) => {
  const { secret } = await c.req.json<{ secret: string }>();
  if (!secret || secret !== c.env.ADMIN_RESET_SECRET) {
    return c.json({ error: "Invalid reset secret" }, 403);
  }
  deleteCookie(c, "better-auth.session_token", { path: "/" });
  return c.json({ ok: true, message: "Admin session cleared" });
});

// ------------------------------------------------------------------
// Admin: recover — wipes the admin user so /api/admin/setup works again
// Cascades to session and account tables automatically.
// ------------------------------------------------------------------
viewerRoutes.post("/admin/recover", async (c) => {
  const { secret } = await c.req.json<{ secret: string }>();
  if (!secret || secret !== c.env.ADMIN_RESET_SECRET) {
    return c.json({ error: "Invalid reset secret" }, 403);
  }
  await c.env.DB.prepare("DELETE FROM user").run();
  await logAdminEvent(c.env.DB, "ADMIN_RECOVER");
  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Admin: recover-by-email — send OTP to stored recovery email
// No auth required (locked-out admin can't authenticate)
// ------------------------------------------------------------------
viewerRoutes.post("/admin/recover-by-email", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT value FROM app_config WHERE key = 'recovery_email'"
  ).first<{ value: string }>();

  // Always return ok to avoid leaking whether a recovery email is configured
  if (!row) return c.json({ ok: true });

  const origin = new URL(c.req.raw.url).origin;
  try {
    await auth(c.env, origin).api.signInMagicLink({
      body: { email: row.value, callbackURL: "/admin" },
      headers: c.req.raw.headers,
    });
  } catch (err) {
    console.error("[recover-by-email] Failed to send magic link:", err);
  }

  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Admin: magic-link sign-in — guard: only send to the registered admin email
// No auth required (this IS the login entry point)
// Always returns ok to avoid leaking whether the email is admin.
// ------------------------------------------------------------------
viewerRoutes.post("/admin/magic-link", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const adminRow = await c.env.DB.prepare(
    "SELECT email FROM user LIMIT 1"
  ).first<{ email: string }>();

  if (adminRow && adminRow.email.toLowerCase() === email) {
    const origin = new URL(c.req.raw.url).origin;
    try {
      await auth(c.env, origin).api.signInMagicLink({
        body: { email, callbackURL: "/admin" },
        headers: c.req.raw.headers,
      });
    } catch (err) {
      console.error("[admin/magic-link] Failed to send magic link:", err);
    }
  }

  // Always return ok — no info leakage about whether email matched
  return c.json({ ok: true });
});

// Better-auth handler is mounted directly on the main app in index.ts
// so it receives the full /api/auth/* path that it expects.
