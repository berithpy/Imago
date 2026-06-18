import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Bindings } from "../index";
import { auth } from "../lib/auth";
import { getDb, type Db } from "../lib/db";
import { resolveActorContext, type ActorContext } from "../lib/roles";
import { galleries, galleryAllowedEmails } from "../lib/schema";

export type ViewerAuthMethod =
  | "public"
  | "password"
  | "magic_link"
  | "admin_bypass";

export type ViewerJWTPayload = {
  sub: "viewer";
  galleryId: string;
  tenantId?: string | null;
  // How the viewer obtained this token. Optional for backwards compatibility
  // with tokens minted before this field was added — those will be reported
  // as `password` by the resolver since that was the only JWT-issuing path.
  auth_method?: Exclude<ViewerAuthMethod, "public" | "magic_link">;
  exp: number;
};

export type AdminJWTPayload = {
  sub: "admin";
  userId: string;
  exp: number;
};

/** Returns true when the given gallery slug exists and is publicly accessible (no auth required). */
async function checkPublicGallery(
  db: Db,
  slug: string | undefined
): Promise<boolean> {
  if (!slug) return false;
  const gallery = await db
    .select({ isPublic: galleries.isPublic })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), isNull(galleries.deletedAt)))
    .get();
  return !!gallery?.isPublic;
}

/**
 * Middleware: require a valid viewer JWT cookie OR a better-auth session with
 * the user's email on the gallery's allowed-emails list.
 * Public galleries bypass auth entirely.
 */
export async function requireViewer(
  c: Context<{
    Bindings: Bindings;
    Variables: { viewerPayload: ViewerJWTPayload; viewerAuthMethod?: ViewerAuthMethod };
  }>,
  next: Next
) {
  const slug = c.req.param("slug");
  const db = getDb(c.env);

  // 1. Public gallery — no auth needed
  if (await checkPublicGallery(db, slug)) {
    c.set("viewerAuthMethod", "public" satisfies ViewerAuthMethod);
    await next();
    return;
  }

  // 2. Viewer JWT cookie (password-based login / admin bypass)
  const token = getCookie(c, "viewer_token");
  if (token) {
    let payload: ViewerJWTPayload;
    try {
      payload = (await verify(token, c.env.JWT_SECRET, "HS256")) as ViewerJWTPayload;
    } catch {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    if (payload.sub !== "viewer") return c.json({ error: "Forbidden" }, 403);

    if (slug) {
      const gallery = await db
        .select({ id: galleries.id })
        .from(galleries)
        .where(eq(galleries.slug, slug))
        .get();

      if (!gallery || gallery.id !== payload.galleryId) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }

    c.set("viewerPayload", payload);
    c.set(
      "viewerAuthMethod",
      (payload.auth_method ?? "password") satisfies ViewerAuthMethod
    );
    await next();
    return;
  }

  // 3. Better-auth session (magic link / email user)
  if (slug) {
    try {
      const origin = new URL(c.req.raw.url).origin;
      const session = await auth(c.env, origin).api.getSession({
        headers: c.req.raw.headers,
      });
      if (session?.user?.email) {
        const gallery = await db
          .select({ id: galleries.id })
          .from(galleries)
          .where(and(eq(galleries.slug, slug), isNull(galleries.deletedAt)))
          .get();
        if (gallery) {
          const allowed = await db
            .select({ id: galleryAllowedEmails.id })
            .from(galleryAllowedEmails)
            .where(
              and(
                eq(galleryAllowedEmails.galleryId, gallery.id),
                eq(sql`lower(${galleryAllowedEmails.email})`, session.user.email.toLowerCase())
              )
            )
            .get();
          if (allowed) {
            c.set("viewerAuthMethod", "magic_link" satisfies ViewerAuthMethod);
            await next();
            return;
          }
        }
      }
    } catch {
      // fall through to 401
    }
  }

  return c.json({ error: "Unauthorized" }, 401);
}

/**
 * Authenticate a request as either a better-auth admin session or a viewer JWT.
 * Returns either an error Response (to return immediately) or an `ok` result
 * with the optional viewer payload. Does not consult public-gallery state —
 * callers handle public bypass before invoking this.
 */
export async function authenticateViewerOrAdmin(
  c: Context<{ Bindings: Bindings; Variables: Record<string, unknown> }>
): Promise<
  | { ok: true; viewerPayload?: ViewerJWTPayload; isAdmin: boolean }
  | { ok: false; response: Response }
> {
  // Check admin session first
  try {
    const origin = new URL(c.req.raw.url).origin;
    const session = await auth(c.env, origin).api.getSession({
      headers: c.req.raw.headers,
    });
    if (session) {
      return { ok: true, isAdmin: true };
    }
  } catch {
    // fall through to viewer JWT check
  }

  // Fall back to viewer JWT
  const token = getCookie(c, "viewer_token");
  if (!token) return { ok: false, response: c.json({ error: "Unauthorized" }, 401) };

  const jwtSecret = (c.env as { JWT_SECRET?: string }).JWT_SECRET;
  if (!jwtSecret) {
    return { ok: false, response: c.json({ error: "Server configuration error" }, 500) };
  }

  let payload: ViewerJWTPayload;
  try {
    payload = (await verify(token, jwtSecret, "HS256")) as ViewerJWTPayload;
  } catch {
    return { ok: false, response: c.json({ error: "Invalid or expired token" }, 401) };
  }

  if (payload.sub !== "viewer") {
    return { ok: false, response: c.json({ error: "Forbidden" }, 403) };
  }

  return { ok: true, viewerPayload: payload, isAdmin: false };
}

/**
 * Middleware: require either a valid admin session (better-auth) OR a valid viewer JWT.
 * Used for image serving so admins can view images without a viewer token.
 */
export async function requireViewerOrAdmin(
  c: Context<{
    Bindings: Bindings;
    Variables: { viewerPayload?: ViewerJWTPayload; viewerAuthMethod?: ViewerAuthMethod };
  }>,
  next: Next
) {
  // Public galleries: allow access without any token
  const slug = c.req.param("slug");
  if (await checkPublicGallery(getDb(c.env), slug)) {
    await next();
    return;
  }

  const result = await authenticateViewerOrAdmin(c);
  if (!result.ok) return result.response;
  if (result.viewerPayload) c.set("viewerPayload", result.viewerPayload);
  await next();
}

// ------------------------------------------------------------------
// Capability-based admin guard
// Resolves an ActorContext, then runs `check(actor)` to decide.
// 401 if anonymous, 403 if signed in but lacking the capability.
// ------------------------------------------------------------------

export type CapabilityCheck = (
  actor: ActorContext,
  c: Context<{ Bindings: Bindings; Variables: Record<string, unknown> }>
) => boolean | Promise<boolean>;

export function requireCapability(check: CapabilityCheck) {
  return async (
    c: Context<{ Bindings: Bindings; Variables: Record<string, unknown> }>,
    next: Next
  ) => {
    const actor = await resolveActorContext(c);
    if (!actor.user) return c.json({ error: "Unauthorized" }, 401);
    const ok = await check(actor, c);
    if (!ok) return c.json({ error: "Forbidden" }, 403);
    c.set("actor", actor);
    await next();
  };
}

// ------------------------------------------------------------------
// Tenant membership guard
// Used on the tenant-scoped admin mount (/api/t/:slug/admin/*) to ensure
// the actor is either an Imago operator or a direct member of the tenant
// resolved by `requireTenant`. Skips the `/setup` bootstrap path so the
// first admin can be created.
// ------------------------------------------------------------------
export async function requireTenantMember(
  c: Context<{ Bindings: Bindings; Variables: Record<string, unknown> }>,
  next: Next
) {
  if (c.req.path.endsWith("/setup")) return next();
  const tenantId = c.get("tenantId") as string | undefined;
  const actor = await resolveActorContext(c);
  if (!actor.user) return c.json({ error: "Unauthorized" }, 401);
  if (actor.superAdmin) {
    c.set("actor", actor);
    return next();
  }
  if (!tenantId) return c.json({ error: "Forbidden" }, 403);
  const isMember = actor.memberships.some((m) => m.tenantId === tenantId);
  if (!isMember) return c.json({ error: "Forbidden" }, 403);
  c.set("actor", actor);
  await next();
}
