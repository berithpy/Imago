import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { Bindings } from "../index";
import { auth } from "../lib/auth";
import { getDb } from "../lib/db";
import { parsePositiveInt } from "../lib/pagination";
import { resolveActorContext } from "../lib/roles";
import {
  addAllowedEmail,
  checkGallerySlug,
  createGallery,
  deletePhoto,
  exportGalleryAdmin,
  finalizeAdminSetup,
  getAdminGalleryById,
  getAdminGalleryBySlug,
  isAdminConfigured,
  issueViewerBypass,
  listAdminLog,
  listAllowedEmails,
  listGalleriesAdmin,
  permanentDeleteGallery,
  removeAllowedEmail,
  resetGalleryPassword,
  restoreGallery,
  setBannerPhoto,
  setGalleryVisibility,
  softDeleteGallery,
  updateGallerySettings,
  uploadPhoto,
} from "../services/galleryAdminService";
import {
  inviteLegacyPlatformUser,
  listPlatformUsers,
} from "../services/adminAuthService";
import { ServiceError } from "../services/types";
import type { TenantVariables } from "../middleware/tenant";
import { membersRoutes } from "./members";
import { brandingRoutes } from "./branding";

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

function svc(c: { env: Bindings }) {
  return { env: c.env, db: getDb(c.env), actor: null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapErr(c: any, err: unknown) {
  if (err instanceof ServiceError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ error: err.message }, err.status as any);
  }
  throw err;
}

// ------------------------------------------------------------------
// Better-auth session guard — excludes /setup
// ------------------------------------------------------------------
adminRoutes.use("/*", async (c, next) => {
  if (c.req.path.endsWith("/setup")) return next();
  const origin = new URL(c.req.raw.url).origin;
  const session = await auth(c.env, origin).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

// Mount tenant member-management endpoints — they piggy-back on the
// session guard above and on requireTenantMember on the tenant-scoped
// admin mount in `index.ts`.
adminRoutes.route("/members", membersRoutes);
adminRoutes.route("/branding", brandingRoutes);

// ------------------------------------------------------------------
// One-time admin setup
// ------------------------------------------------------------------
adminRoutes.post("/setup", async (c) => {
  const ctx = svc(c);
  if (await isAdminConfigured(ctx)) {
    return c.json({ error: "Admin already configured" }, 403);
  }
  const { email, password, name, recoveryEmail } = await c.req.json<{
    email: string;
    password: string;
    name: string;
    recoveryEmail?: string;
  }>();

  const origin = new URL(c.req.raw.url).origin;
  const result = await auth(c.env, origin).api.signUpEmail({
    body: { email, password, name },
  });

  await finalizeAdminSetup(ctx, { email, recoveryEmail });
  return c.json({ ok: true, user: result });
});

// ------------------------------------------------------------------
// Galleries CRUD
// ------------------------------------------------------------------

adminRoutes.get("/galleries/check-slug", async (c) => {
  const slug = c.req.query("slug") ?? "";
  const result = await checkGallerySlug(svc(c), slug, c.get("tenantId"));
  return c.json(result);
});

adminRoutes.get("/galleries", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const sort = c.req.query("sort") ?? "created_desc";
  const galleries = await listGalleriesAdmin(svc(c), {
    q,
    sort,
    tenantId: c.get("tenantId"),
  });
  return c.json({ galleries });
});

adminRoutes.post("/galleries", async (c) => {
  const body = await c.req.json<{
    name: string;
    slug: string;
    password?: string;
    description?: string;
    is_public?: boolean;
    event_date?: number | null;
    expires_at?: number | null;
  }>();

  try {
    const actor = await resolveActorContext(c);
    const gallery = await createGallery(svc(c), {
      ...body,
      tenantId: c.get("tenantId"),
      actor,
    });
    return c.json({ ok: true, gallery }, 201);
  } catch (err) {
    return mapErr(c, err);
  }
});

adminRoutes.delete("/galleries/:id", async (c) => {
  await softDeleteGallery(svc(c), c.req.param("id"), c.get("tenantId"));
  return c.json({ ok: true });
});

adminRoutes.post("/galleries/:id/restore", async (c) => {
  await restoreGallery(svc(c), c.req.param("id"), c.get("tenantId"));
  return c.json({ ok: true });
});

adminRoutes.delete("/galleries/:id/permanent", async (c) => {
  try {
    const actor = await resolveActorContext(c);
    await permanentDeleteGallery(svc(c), {
      id: c.req.param("id"),
      tenantId: c.get("tenantId"),
      actor,
    });
    return c.json({ ok: true });
  } catch (err) {
    return mapErr(c, err);
  }
});

adminRoutes.patch("/galleries/:id/banner", async (c) => {
  const { photoId } = await c.req.json<{ photoId: string | null }>();
  try {
    await setBannerPhoto(svc(c), {
      galleryId: c.req.param("id"),
      photoId,
      tenantId: c.get("tenantId"),
    });
    return c.json({ ok: true });
  } catch (err) {
    return mapErr(c, err);
  }
});

adminRoutes.patch("/galleries/:id/visibility", async (c) => {
  const { is_public } = await c.req.json<{ is_public: boolean }>();
  await setGalleryVisibility(svc(c), {
    id: c.req.param("id"),
    isPublic: is_public,
    tenantId: c.get("tenantId"),
  });
  return c.json({ ok: true });
});

adminRoutes.patch("/galleries/:id/settings", async (c) => {
  const body = await c.req.json<{
    name?: string;
    description?: string | null;
    event_date?: number | null;
    expires_at?: number | null;
    share_preview_enabled?: boolean;
  }>();
  try {
    await updateGallerySettings(svc(c), {
      ...body,
      id: c.req.param("id"),
      tenantId: c.get("tenantId"),
    });
    return c.json({ ok: true });
  } catch (err) {
    return mapErr(c, err);
  }
});

adminRoutes.patch("/galleries/:id/password", async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  try {
    await resetGalleryPassword(svc(c), {
      id: c.req.param("id"),
      password,
      tenantId: c.get("tenantId"),
    });
    return c.json({ ok: true });
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Export
// ------------------------------------------------------------------
adminRoutes.get("/galleries/:id/export", async (c) => {
  try {
    const result = await exportGalleryAdmin(svc(c), c.req.param("id"), c.get("tenantId"));
    return c.json(result);
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Resolve gallery by slug
// ------------------------------------------------------------------
adminRoutes.get("/galleries/by-slug/:slug", async (c) => {
  try {
    const result = await getAdminGalleryBySlug(svc(c), c.req.param("slug"), c.get("tenantId"));
    return c.json(result);
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Photos: list / upload / delete
// ------------------------------------------------------------------
adminRoutes.get("/galleries/:id/photos", async (c) => {
  try {
    const result = await getAdminGalleryById(svc(c), c.req.param("id"), c.get("tenantId"));
    return c.json(result);
  } catch (err) {
    return mapErr(c, err);
  }
});

adminRoutes.post("/galleries/:id/photos", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "No file provided" }, 400);

  try {
    const result = await uploadPhoto(svc(c), {
      galleryId: c.req.param("id"),
      tenantId: c.get("tenantId"),
      file,
      appOrigin: new URL(c.req.raw.url).origin,
    });
    if (result.notify) c.executionCtx?.waitUntil(result.notify);
    const { notify, ...photo } = result;
    void notify;
    return c.json({ ok: true, photo }, 201);
  } catch (err) {
    return mapErr(c, err);
  }
});

adminRoutes.delete("/galleries/:galleryId/photos/:photoId", async (c) => {
  try {
    await deletePhoto(svc(c), {
      galleryId: c.req.param("galleryId"),
      photoId: c.req.param("photoId"),
    });
    return c.json({ ok: true });
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Admin viewer bypass — set viewer_token cookie for any gallery
// ------------------------------------------------------------------
adminRoutes.post("/galleries/:id/viewer-bypass", async (c) => {
  try {
    const result = await issueViewerBypass(svc(c), {
      galleryId: c.req.param("id"),
      tenantId: c.get("tenantId"),
      jwtSecret: c.env.JWT_SECRET,
    });
    setCookie(c, "viewer_token", result.token, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: result.maxAgeSeconds,
      path: "/",
    });
    return c.json({ ok: true, slug: result.slug });
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Admin log — superAdmin-only
// ------------------------------------------------------------------
adminRoutes.get("/log", async (c) => {
  try {
    const actor = await resolveActorContext(c);
    const log = await listAdminLog(svc(c), actor);
    return c.json({ log });
  } catch (err) {
    return mapErr(c, err);
  }
});

// ------------------------------------------------------------------
// Per-gallery email whitelist
// ------------------------------------------------------------------
adminRoutes.get("/galleries/:id/allowed-emails", async (c) => {
  const allowedEmails = await listAllowedEmails(svc(c), c.req.param("id"));
  return c.json({ allowedEmails });
});

adminRoutes.post("/galleries/:id/allowed-emails", async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  try {
    const result = await addAllowedEmail(svc(c), {
      galleryId: c.req.param("id"),
      email,
      tenantId: c.get("tenantId"),
      appOrigin: new URL(c.req.raw.url).origin,
    });
    return c.json({ ok: true, id: result.id }, 201);
  } catch (err) {
    return mapErr(c, err);
  }
});

adminRoutes.delete("/galleries/:id/allowed-emails/:email", async (c) => {
  await removeAllowedEmail(svc(c), {
    galleryId: c.req.param("id"),
    email: decodeURIComponent(c.req.param("email")),
  });
  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Admin user management (operator-only)
// ------------------------------------------------------------------
adminRoutes.get("/users", async (c) => {
  try {
    const actor = await resolveActorContext(c);
    const page = parsePositiveInt(c.req.query("page"));
    const pageSize = parsePositiveInt(c.req.query("pageSize"));
    const safePageSize = pageSize ? Math.min(pageSize, 100) : undefined;
    const safePage = safePageSize ? page ?? 1 : undefined;

    const result = await listPlatformUsers(svc(c), {
      actor,
      tenantId: c.req.query("tenantId"),
      q: (c.req.query("q") ?? "").trim(),
      page: safePage,
      pageSize: safePageSize,
      superAdminOnly: c.req.query("superAdminOnly") === "1",
    });

    if (safePage && safePageSize) {
      return c.json({
        users: result.users,
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          total: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / safePageSize)),
        },
      });
    }

    return c.json({ users: result.users });
  } catch (err) {
    return mapErr(c, err);
  }
});

adminRoutes.post("/users/invite", async (c) => {
  const { email, name } = await c.req.json<{ email: string; name: string }>();
  try {
    const actor = await resolveActorContext(c);
    const user = await inviteLegacyPlatformUser(svc(c), {
      actor,
      email,
      name,
      appOrigin: new URL(c.req.raw.url).origin,
      requestHeaders: c.req.raw.headers,
      tenantId: c.get("tenantId") ?? null,
    });
    return c.json({ ok: true, user });
  } catch (err) {
    return mapErr(c, err);
  }
});