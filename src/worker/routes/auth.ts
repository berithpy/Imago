import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { Bindings } from "../index";
import { pbkdf2Verify } from "../lib/crypto";
import { auth } from "../lib/auth";

export const viewerRoutes = new Hono<{ Bindings: Bindings }>();

// ------------------------------------------------------------------
// Viewer: unlock a gallery with its password
// ------------------------------------------------------------------
viewerRoutes.post("/gallery/:slug/login", async (c) => {
  const { slug } = c.req.param();
  const { password } = await c.req.json<{ password: string }>();

  if (!password) return c.json({ error: "Password required" }, 400);

  const gallery = await c.env.DB.prepare(
    "SELECT id, password_hash, is_public FROM galleries WHERE slug = ? AND deleted_at IS NULL"
  )
    .bind(slug)
    .first<{ id: string; password_hash: string; is_public: number }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  // Public galleries: skip password check
  if (!gallery.is_public) {
    const valid = await pbkdf2Verify(password, gallery.password_hash);
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

// Better-auth handler is mounted directly on the main app in index.ts
// so it receives the full /api/auth/* path that it expects.
