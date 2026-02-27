import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { Bindings } from "../index";
import { auth } from "../lib/auth";

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

/** Returns true when the given gallery slug exists and is publicly accessible (no auth required). */
async function checkPublicGallery(
  db: D1Database,
  slug: string | undefined
): Promise<boolean> {
  if (!slug) return false;
  const gallery = await db
    .prepare("SELECT is_public FROM galleries WHERE slug = ? AND deleted_at IS NULL")
    .bind(slug)
    .first<{ is_public: number }>();
  return !!gallery?.is_public;
}

/**
 * Middleware: require a valid viewer JWT cookie.
 * Also checks that the token's galleryId matches the :slug param in D1.
 * Public galleries bypass JWT entirely.
 */
export async function requireViewer(
  c: Context<{ Bindings: Bindings; Variables: { viewerPayload: ViewerJWTPayload } }>,
  next: Next
) {
  // Public galleries: allow access without any token
  const slug = c.req.param("slug");
  if (await checkPublicGallery(c.env.DB, slug)) {
    await next();
    return;
  }

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

/**
 * Middleware: require either a valid admin session (better-auth) OR a valid viewer JWT.
 * Used for image serving so admins can view images without a viewer token.
 */
export async function requireViewerOrAdmin(
  c: Context<{ Bindings: Bindings; Variables: { viewerPayload?: ViewerJWTPayload } }>,
  next: Next
) {
  // Public galleries: allow access without any token
  const slug = c.req.param("slug");
  if (await checkPublicGallery(c.env.DB, slug)) {
    await next();
    return;
  }

  // Check admin session first
  try {
    const origin = new URL(c.req.raw.url).origin;
    const session = await auth(c.env, origin).api.getSession({
      headers: c.req.raw.headers,
    });
    if (session) {
      await next();
      return;
    }
  } catch {
    // fall through to viewer JWT check
  }

  // Fall back to viewer JWT
  const token = getCookie(c, "viewer_token");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  // Read JWT secret from environment with a narrow assertion to avoid relying
  // on a removed binding type, and fail explicitly if it's not configured.
  const jwtSecret = (c.env as { JWT_SECRET?: string }).JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ error: "Server configuration error" }, 500);
  }

  let payload: ViewerJWTPayload;
  try {
    payload = (await verify(token, jwtSecret, "HS256")) as ViewerJWTPayload;
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  if (payload.sub !== "viewer") return c.json({ error: "Forbidden" }, 403);

  c.set("viewerPayload", payload);
  await next();
}
