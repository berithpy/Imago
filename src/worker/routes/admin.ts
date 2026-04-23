import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { Bindings } from "../index";
import { pbkdf2Hash } from "../lib/crypto";
import { auth } from "../lib/auth";
import { logAdminEvent } from "../lib/adminLog";
import { sendEmail, invitedUserHtml, newPhotosHtml } from "../lib/email";
import { tenantClause } from "../lib/db";
import type { TenantVariables } from "../middleware/tenant";

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

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

// ------------------------------------------------------------------
// One-time admin setup — creates the admin user in better-auth
// Disabled after first user exists
// ------------------------------------------------------------------
adminRoutes.post("/setup", async (c) => {
  // Check if admin already exists
  const existing = await c.env.DB.prepare("SELECT id FROM user LIMIT 1").first();
  if (existing) {
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

  // Promote the first user to super-admin
  await c.env.DB.prepare(
    "UPDATE user SET is_super_admin = 1 WHERE email = ?"
  ).bind(email).run();

  // Store recovery email in app_config (defaults to admin email)
  const resolvedRecovery = recoveryEmail?.trim() || email;
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO app_config (key, value) VALUES ('recovery_email', ?)"
  ).bind(resolvedRecovery).run();

  await logAdminEvent(c.env.DB, "ADMIN_SETUP");

  return c.json({ ok: true, user: result });
});

// ------------------------------------------------------------------
// Galleries CRUD
// ------------------------------------------------------------------

// check-slug — session-guarded, returns { valid, available, reserved }
const RESERVED_GALLERY_SLUGS = ["admin", "login", "setup"];
adminRoutes.get("/galleries/check-slug", async (c) => {
  const slug = c.req.query("slug") ?? "";
  const valid = /^[a-z0-9-]+$/.test(slug);
  if (!valid) return c.json({ valid: false, available: false, reserved: false });
  const reserved = RESERVED_GALLERY_SLUGS.includes(slug);
  if (reserved) return c.json({ valid: true, available: false, reserved: true });
  const tenantId: string | undefined = c.get("tenantId");
  const [tSql, tBindings] = tenantClause(tenantId);
  const existing = await c.env.DB.prepare(
    `SELECT id FROM galleries WHERE slug = ?${tSql}`
  ).bind(slug, ...tBindings).first();
  return c.json({ valid: true, available: !existing, reserved: false });
});

adminRoutes.get("/galleries", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const sort = c.req.query("sort") ?? "created_desc";

  const SORT_MAP: Record<string, string> = {
    created_desc: "created_at DESC",
    created_asc: "created_at ASC",
    name_asc: "name ASC",
    name_desc: "name DESC",
    event_desc: "COALESCE(event_date, 0) DESC",
    event_asc: "COALESCE(event_date, 0) ASC",
  };
  const orderBy = SORT_MAP[sort] ?? "created_at DESC";

  const tenantId: string | undefined = c.get("tenantId");
  const [tSql, tBindings] = tenantClause(tenantId);
  const SELECT = "SELECT id, name, slug, description, is_public, banner_photo_id, event_date, expires_at, deleted_at, created_at FROM galleries";

  let results;
  if (q) {
    const like = `%${q}%`;
    ({ results } = await c.env.DB.prepare(
      `${SELECT} WHERE (name LIKE ? OR slug LIKE ? OR description LIKE ?)${tSql} ORDER BY ${orderBy}`
    ).bind(like, like, like, ...tBindings).all());
  } else {
    ({ results } = await c.env.DB.prepare(
      `${SELECT} WHERE 1=1${tSql} ORDER BY ${orderBy}`
    ).bind(...tBindings).all());
  }

  return c.json({ galleries: results });
});

adminRoutes.post("/galleries", async (c) => {
  const { name, slug, password, description, is_public, event_date, expires_at } = await c.req.json<{
    name: string;
    slug: string;
    password: string;
    description?: string;
    is_public?: boolean;
    event_date?: number | null;
    expires_at?: number | null;
  }>();

  if (!name || !slug || (!is_public && !password)) {
    return c.json(
      { error: "name and slug are required; password is required for private galleries" },
      400
    );
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return c.json(
      { error: "Slug must only contain lowercase letters, numbers, and dashes" },
      400
    );
  }

  // Reject reserved words
  if (RESERVED_GALLERY_SLUGS.includes(slug)) {
    return c.json({ error: "Slug is reserved" }, 400);
  }

  // Check slug uniqueness
  const existing = await c.env.DB.prepare(
    "SELECT id FROM galleries WHERE slug = ?"
  )
    .bind(slug)
    .first();
  if (existing) return c.json({ error: "Slug already in use" }, 409);

  const tenantId: string | undefined = c.get("tenantId");
  const id = crypto.randomUUID();
  const passwordHash = await pbkdf2Hash(password);
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    "INSERT INTO galleries (id, tenant_id, name, slug, password_hash, description, is_public, event_date, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, tenantId ?? null, name, slug, passwordHash, description ?? null, is_public ? 1 : 0, event_date ?? null, expires_at ?? null, now)
    .run();

  await logAdminEvent(c.env.DB, "GALLERY_CREATED", slug);

  return c.json({ ok: true, gallery: { id, name, slug, description, is_public: is_public ? 1 : 0, event_date: event_date ?? null, expires_at: expires_at ?? null, created_at: now } }, 201);
});

adminRoutes.delete("/galleries/:id", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(`UPDATE galleries SET deleted_at = ? WHERE id = ?${tSql}`)
    .bind(now, id, ...tBindings)
    .run();
  return c.json({ ok: true });
});

// Restore a soft-deleted gallery
adminRoutes.post("/galleries/:id/restore", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  await c.env.DB.prepare(`UPDATE galleries SET deleted_at = NULL WHERE id = ?${tSql}`)
    .bind(id, ...tBindings)
    .run();
  return c.json({ ok: true });
});

// Permanently delete (removes R2 objects + D1 rows)
adminRoutes.delete("/galleries/:id/permanent", async (c) => {
  const { id } = c.req.param();

  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  // Get all photos to remove from R2
  const { results: photos } = await c.env.DB.prepare(
    "SELECT r2_key FROM photos WHERE gallery_id = ?"
  )
    .bind(id)
    .all<{ r2_key: string }>();

  // Delete from R2
  await Promise.all(photos.map((p) => c.env.IMAGES_BUCKET.delete(p.r2_key)));

  // D1 cascade handles photos + subscribers deletion
  await c.env.DB.prepare(`DELETE FROM galleries WHERE id = ?${tSql}`).bind(id, ...tBindings).run();

  return c.json({ ok: true });
});

// Set or unset banner photo
adminRoutes.patch("/galleries/:id/banner", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const { photoId } = await c.req.json<{ photoId: string | null }>();

  // Verify photo belongs to this gallery (if setting)
  if (photoId) {
    const photo = await c.env.DB.prepare(
      "SELECT id FROM photos WHERE id = ? AND gallery_id = ?"
    ).bind(photoId, id).first();
    if (!photo) return c.json({ error: "Photo not found in this gallery" }, 404);
  }

  await c.env.DB.prepare(`UPDATE galleries SET banner_photo_id = ? WHERE id = ?${tSql}`)
    .bind(photoId ?? null, id, ...tBindings)
    .run();
  return c.json({ ok: true });
});

// Toggle public/private
adminRoutes.patch("/galleries/:id/visibility", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const { is_public } = await c.req.json<{ is_public: boolean }>();
  await c.env.DB.prepare(`UPDATE galleries SET is_public = ? WHERE id = ?${tSql}`)
    .bind(is_public ? 1 : 0, id, ...tBindings)
    .run();
  return c.json({ ok: true });
});

// Update general settings (name, description, event_date, expires_at)
adminRoutes.patch("/galleries/:id/settings", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const { name, description, event_date, expires_at } = await c.req.json<{
    name?: string;
    description?: string | null;
    event_date?: number | null;
    expires_at?: number | null;
  }>();

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (description !== undefined) { fields.push("description = ?"); values.push(description); }
  if (event_date !== undefined) { fields.push("event_date = ?"); values.push(event_date); }
  if (expires_at !== undefined) { fields.push("expires_at = ?"); values.push(expires_at); }

  if (!fields.length) return c.json({ error: "Nothing to update" }, 400);

  await c.env.DB.prepare(`UPDATE galleries SET ${fields.join(", ")} WHERE id = ?${tSql}`)
    .bind(...values, id, ...tBindings)
    .run();

  return c.json({ ok: true });
});

// Reset gallery password
adminRoutes.patch("/galleries/:id/password", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const { password } = await c.req.json<{ password: string }>();
  if (!password || password.length < 4) {
    return c.json({ error: "Password must be at least 4 characters" }, 400);
  }
  const passwordHash = await pbkdf2Hash(password);
  const result = await c.env.DB.prepare(
    `UPDATE galleries SET password_hash = ? WHERE id = ?${tSql}`
  )
    .bind(passwordHash, id, ...tBindings)
    .run();
  if (!result.meta.changes) return c.json({ error: "Gallery not found" }, 404);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Export: generate pre-signed R2 URLs for all photos in a gallery
// ------------------------------------------------------------------
adminRoutes.get("/galleries/:id/export", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));

  const gallery = await c.env.DB.prepare(
    `SELECT id, name, slug FROM galleries WHERE id = ?${tSql}`
  )
    .bind(id, ...tBindings)
    .first<{ id: string; name: string; slug: string }>();
  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const { results: photoRows } = await c.env.DB.prepare(
    "SELECT id, r2_key, original_name FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, uploaded_at ASC"
  )
    .bind(id)
    .all<{ id: string; r2_key: string; original_name: string }>();

  const photos = photoRows.map((p) => ({
    name: p.original_name,
    url: `/api/images/${p.r2_key}?variant=full`,
  }));

  return c.json({ galleryName: gallery.name, photos });
});

// ------------------------------------------------------------------
// Photos: list
// ------------------------------------------------------------------
adminRoutes.get("/galleries/:id/photos", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const gallery = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.slug, g.is_public, g.banner_photo_id, p.r2_key AS banner_r2_key,
            g.event_date, g.expires_at
     FROM galleries g
     LEFT JOIN photos p ON p.id = g.banner_photo_id
     WHERE g.id = ?${tSql}`
  )
    .bind(id, ...tBindings)
    .first<{ id: string; name: string; slug: string; is_public: number; banner_photo_id: string | null; banner_r2_key: string | null; event_date: number | null; expires_at: number | null }>();
  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const { results } = await c.env.DB.prepare(
    "SELECT id, r2_key, original_name, size, uploaded_at FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, uploaded_at ASC"
  )
    .bind(id)
    .all();
  return c.json({ gallery, photos: results });
});

// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Photos: upload
// ------------------------------------------------------------------
adminRoutes.post("/galleries/:id/photos", async (c) => {
  const { id } = c.req.param();
  const tenantId = c.get("tenantId");
  if (!tenantId) return c.json({ error: "Tenant required" }, 400);
  const [tSql, tBindings] = tenantClause(tenantId);

  const gallery = await c.env.DB.prepare(
    `SELECT id, name, slug FROM galleries WHERE id = ?${tSql}`
  )
    .bind(id, ...tBindings)
    .first<{ id: string; name: string; slug: string }>();
  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "No file provided" }, 400);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const photoId = crypto.randomUUID();
  const r2Key = `${tenantId}/galleries/${id}/${photoId}.${ext}`;

  // Stream directly to R2 — never buffer full file
  await c.env.IMAGES_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: file.name,
      galleryId: id,
      tenantId,
    },
  });

  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(photoId, id, r2Key, file.name, file.size, now, now)
    .run();

  // Notify verified subscribers — non-blocking
  const { results: subscribers } = await c.env.DB.prepare(
    "SELECT email FROM gallery_subscribers WHERE gallery_id = ? AND verified = 1"
  ).bind(id).all<{ email: string }>();

  if (subscribers.length > 0) {
    const origin = new URL(c.req.raw.url).origin;
    const galleryUrl = `${origin}/gallery/${gallery.slug}`;
    const notifyAll = Promise.all(
      subscribers.map((s) =>
        sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, {
          to: s.email,
          subject: `New photo added to ${gallery.name}`,
          html: newPhotosHtml(gallery.name, galleryUrl, 1),
        })
      )
    );
    c.executionCtx?.waitUntil(notifyAll);
  }

  return c.json(
    { ok: true, photo: { id: photoId, r2_key: r2Key, original_name: file.name, size: file.size, uploaded_at: now } },
    201
  );
});

// ------------------------------------------------------------------
// Photos: delete
// ------------------------------------------------------------------
adminRoutes.delete("/galleries/:galleryId/photos/:photoId", async (c) => {
  const { galleryId, photoId } = c.req.param();

  const photo = await c.env.DB.prepare(
    "SELECT r2_key FROM photos WHERE id = ? AND gallery_id = ?"
  )
    .bind(photoId, galleryId)
    .first<{ r2_key: string }>();

  if (!photo) return c.json({ error: "Photo not found" }, 404);

  await c.env.IMAGES_BUCKET.delete(photo.r2_key);
  await c.env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(photoId).run();

  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Admin viewer bypass — issue a viewer_token for any gallery without
// needing the gallery password (admin-only, session-gated by middleware)
// ------------------------------------------------------------------
adminRoutes.post("/galleries/:id/viewer-bypass", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));

  const gallery = await c.env.DB.prepare(
    `SELECT id, slug, tenant_id FROM galleries WHERE id = ? AND deleted_at IS NULL${tSql}`
  )
    .bind(id, ...tBindings)
    .first<{ id: string; slug: string; tenant_id: string | null }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const token = await sign(
    { sub: "viewer", galleryId: gallery.id, tenantId: gallery.tenant_id, exp },
    c.env.JWT_SECRET
  );

  setCookie(c, "viewer_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return c.json({ ok: true, slug: gallery.slug });
});

// ------------------------------------------------------------------
// Admin log — read-only audit trail
// ------------------------------------------------------------------
adminRoutes.get("/log", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, event, detail, created_at FROM admin_log ORDER BY created_at DESC LIMIT 200"
  ).all<{ id: number; event: string; detail: string | null; created_at: number }>();
  return c.json({ log: results });
});

// ------------------------------------------------------------------
// Per-gallery email whitelist (admin-only)
// ------------------------------------------------------------------
adminRoutes.get("/galleries/:id/allowed-emails", async (c) => {
  const { id } = c.req.param();
  const { results } = await c.env.DB.prepare(
    "SELECT id, email, added_at FROM gallery_allowed_emails WHERE gallery_id = ? ORDER BY added_at ASC"
  ).bind(id).all<{ id: string; email: string; added_at: number }>();
  return c.json({ allowedEmails: results });
});

adminRoutes.post("/galleries/:id/allowed-emails", async (c) => {
  const { id } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const { email } = await c.req.json<{ email: string }>();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const gallery = await c.env.DB.prepare(
    `SELECT id, name, slug FROM galleries WHERE id = ? AND deleted_at IS NULL${tSql}`
  ).bind(id, ...tBindings).first<{ id: string; name: string; slug: string }>();
  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const entryId = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      "INSERT INTO gallery_allowed_emails (id, gallery_id, email) VALUES (?, ?, ?)"
    ).bind(entryId, id, email.trim().toLowerCase()).run();
  } catch {
    return c.json({ error: "Email already on the access list" }, 409);
  }

  const origin = new URL(c.req.raw.url).origin;
  const galleryUrl = `${origin}/gallery/${gallery.slug}`;
  await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, {
    to: email,
    subject: `You've been invited to view ${gallery.name}`,
    html: invitedUserHtml(gallery.name, galleryUrl, email),
  });

  return c.json({ ok: true, id: entryId }, 201);
});

adminRoutes.delete("/galleries/:id/allowed-emails/:email", async (c) => {
  const { id, email } = c.req.param();
  const decodedEmail = decodeURIComponent(email);
  await c.env.DB.prepare(
    "DELETE FROM gallery_allowed_emails WHERE gallery_id = ? AND lower(email) = lower(?)"
  ).bind(id, decodedEmail).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Admin user management
// ------------------------------------------------------------------
adminRoutes.get("/users", async (c) => {
  // Super-admin only
  const origin = new URL(c.req.raw.url).origin;
  const session = await auth(c.env, origin).api.getSession({ headers: c.req.raw.headers });
  const sessionUser = await c.env.DB.prepare(
    "SELECT is_super_admin FROM user WHERE email = ?"
  ).bind(session!.user.email).first<{ is_super_admin: number }>();
  if (!sessionUser?.is_super_admin) return c.json({ error: "Forbidden" }, 403);

  const tenantId = c.req.query("tenantId");

  if (tenantId) {
    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.is_super_admin, u.createdAt, m.role
       FROM user u
       JOIN member m ON m.userId = u.id
       JOIN organization o ON o.id = m.organizationId
       JOIN tenants t ON t.organization_id = o.id
       WHERE t.id = ?
       ORDER BY u.createdAt DESC`
    ).bind(tenantId).all<{ id: string; name: string; email: string; is_super_admin: number; createdAt: number; role: string }>();
    return c.json({ users: results });
  }

  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.is_super_admin, u.createdAt,
            m.role, t.id AS tenant_id, t.name AS tenant_name
     FROM user u
     LEFT JOIN member m ON m.userId = u.id
     LEFT JOIN organization o ON o.id = m.organizationId
     LEFT JOIN tenants t ON t.organization_id = o.id
     ORDER BY u.createdAt DESC`
  ).all<{ id: string; name: string; email: string; is_super_admin: number; createdAt: number; role: string | null; tenant_id: string | null; tenant_name: string | null }>();
  return c.json({ users: results });
});

adminRoutes.post("/users/invite", async (c) => {
  const { email, name } = await c.req.json<{ email: string; name: string }>();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }
  if (!name?.trim()) {
    return c.json({ error: "Name required" }, 400);
  }

  const origin = new URL(c.req.raw.url).origin;
  try {
    await auth(c.env, origin).api.signUpEmail({
      body: { email: email.trim(), name: name.trim(), password: crypto.randomUUID() },
    });
  } catch (err: any) {
    if (err?.message?.includes("already") || err?.status === 422) {
      return c.json({ error: "User with this email already exists" }, 409);
    }
    return c.json({ error: "Failed to create user" }, 500);
  }

  const adminLoginUrl = `${origin}/admin/login`;
  await sendEmail(c.env.RESEND_API_KEY, c.env.FROM_EMAIL, {
    to: email,
    subject: "You've been invited to Imago",
    html: invitedUserHtml("Imago", adminLoginUrl, email),
  });

  await logAdminEvent(c.env.DB, "USER_INVITED", email);

  return c.json({ ok: true, user: { email, name } });
});
