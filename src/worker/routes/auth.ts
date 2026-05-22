import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { Bindings } from "../index";
import { getDb } from "../lib/db";
import {
  recoverAdmin,
  recoverAdminByEmail,
  requestLegacyAdminMagicLink,
} from "../services/adminAuthService";
import {
  loginToGallery,
  requestViewerMagicLink,
} from "../services/viewerAuthService";
import { ServiceError } from "../services/types";
import type { TenantVariables } from "../middleware/tenant";

export const viewerRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

// Inline error mapping is repeated per handler to keep Hono's `c` typing intact;
// extracting a helper requires a generic over the route literal which adds noise.

// ------------------------------------------------------------------
// Viewer: unlock a gallery with its password
// ------------------------------------------------------------------
viewerRoutes.post("/gallery/:slug/login", async (c) => {
  const { slug } = c.req.param();
  const body = await c.req.json<{ password?: string }>().catch(() => ({} as { password?: string }));

  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    const result = await loginToGallery(ctx, {
      slug,
      tenantId: c.get("tenantId"),
      password: body.password,
      jwtSecret: c.env.JWT_SECRET,
    });

    setCookie(c, "viewer_token", result.token, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: result.maxAgeSeconds,
      path: "/",
    });

    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// Viewer: request a magic link (email must be on the gallery whitelist)
// ------------------------------------------------------------------
viewerRoutes.post("/gallery/:slug/magic-link", async (c) => {
  const { slug } = c.req.param();
  const body = await c.req
    .json<{ email?: string; callbackPath?: string }>()
    .catch(() => ({} as { email?: string; callbackPath?: string }));

  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await requestViewerMagicLink(ctx, {
      slug,
      tenantId: c.get("tenantId"),
      rawEmail: body.email,
      callbackPath: body.callbackPath,
      appOrigin: new URL(c.req.raw.url).origin,
      requestHeaders: c.req.raw.headers,
    });
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
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
  const { secret } = await c.req.json<{ secret: string }>().catch(() => ({ secret: "" }));
  if (!secret || secret !== c.env.ADMIN_RESET_SECRET) {
    return c.json({ error: "Invalid reset secret" }, 403);
  }
  deleteCookie(c, "better-auth.session_token", { path: "/" });
  return c.json({ ok: true, message: "Admin session cleared" });
});

// ------------------------------------------------------------------
// Admin: recover — wipes the admin user so /api/tenant/setup works again
// Cascades to session and account tables automatically.
// ------------------------------------------------------------------
viewerRoutes.post("/admin/recover", async (c) => {
  const body = await c.req.json<{ secret?: string }>().catch(() => ({} as { secret?: string }));
  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await recoverAdmin(ctx, { secret: body.secret });
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// ------------------------------------------------------------------
// Admin: recover-by-email — send OTP to stored recovery email
// No auth required (locked-out admin can't authenticate)
// ------------------------------------------------------------------
viewerRoutes.post("/admin/recover-by-email", async (c) => {
  const ctx = { env: c.env, db: getDb(c.env), actor: null };
  await recoverAdminByEmail(ctx, {
    appOrigin: new URL(c.req.raw.url).origin,
    requestHeaders: c.req.raw.headers,
  });
  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Admin: magic-link sign-in — guard: only send to the registered admin email
// No auth required (this IS the login entry point)
// Always returns ok to avoid leaking whether the email is admin.
// ------------------------------------------------------------------
viewerRoutes.post("/admin/magic-link", async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
  try {
    const ctx = { env: c.env, db: getDb(c.env), actor: null };
    await requestLegacyAdminMagicLink(ctx, {
      rawEmail: body.email,
      appOrigin: new URL(c.req.raw.url).origin,
      requestHeaders: c.req.raw.headers,
    });
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof ServiceError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ error: err.message }, err.status as any);
    }
    throw err;
  }
});

// Better-auth handler is mounted directly on the main app in index.ts
// so it receives the full /api/auth/* path that it expects.