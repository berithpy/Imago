import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { Bindings } from "../index";

export type ViewerJWTPayload = {
  sub: "viewer";
  galleryId: string;
  exp: number;
};

export type AdminJWTPayload = {
  sub: "admin";
  userId: string;
  exp: number;
};

/**
 * Middleware: require a valid viewer JWT cookie.
 * Also checks that the token's galleryId matches the :slug param in D1.
 */
export async function requireViewer(
  c: Context<{ Bindings: Bindings; Variables: { viewerPayload: ViewerJWTPayload } }>,
  next: Next
) {
  const token = getCookie(c, "viewer_token");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  let payload: ViewerJWTPayload;
  try {
    payload = (await verify(token, c.env.JWT_SECRET, "HS256")) as ViewerJWTPayload;
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  if (payload.sub !== "viewer") return c.json({ error: "Forbidden" }, 403);

  // Verify galleryId matches the slug in the URL
  const slug = c.req.param("slug");
  if (slug) {
    const gallery = await c.env.DB.prepare(
      "SELECT id FROM galleries WHERE slug = ?"
    )
      .bind(slug)
      .first<{ id: string }>();

    if (!gallery || gallery.id !== payload.galleryId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  c.set("viewerPayload", payload);
  await next();
}
