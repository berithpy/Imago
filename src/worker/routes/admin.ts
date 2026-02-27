import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { Bindings } from "../index";
import { pbkdf2Hash } from "../lib/crypto";
import { auth } from "../lib/auth";

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

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

  const { email, password, name } = await c.req.json<{
    email: string;
    password: string;
    name: string;
  }>();

  const origin = new URL(c.req.raw.url).origin;
  const result = await auth(c.env, origin).api.signUpEmail({
    body: { email, password, name },
  });

  return c.json({ ok: true, user: result });
});

// ------------------------------------------------------------------
// Galleries CRUD
// ------------------------------------------------------------------
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

  const SELECT = "SELECT id, name, slug, description, is_public, banner_photo_id, event_date, expires_at, deleted_at, created_at FROM galleries";

  let results;
  if (q) {
    const like = `%${q}%`;
    ({ results } = await c.env.DB.prepare(
      `${SELECT} WHERE (name LIKE ? OR slug LIKE ? OR description LIKE ?) ORDER BY ${orderBy}`
    ).bind(like, like, like).all());
  } else {
    ({ results } = await c.env.DB.prepare(
      `${SELECT} ORDER BY ${orderBy}`
    ).all());
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

  // Check slug uniqueness
  const existing = await c.env.DB.prepare(
    "SELECT id FROM galleries WHERE slug = ?"
  )
    .bind(slug)
    .first();
  if (existing) return c.json({ error: "Slug already in use" }, 409);

  const id = crypto.randomUUID();
  const passwordHash = await pbkdf2Hash(password);
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    "INSERT INTO galleries (id, name, slug, password_hash, description, is_public, event_date, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, name, slug, passwordHash, description ?? null, is_public ? 1 : 0, event_date ?? null, expires_at ?? null, now)
    .run();

  return c.json({ ok: true, gallery: { id, name, slug, description, is_public: is_public ? 1 : 0, event_date: event_date ?? null, expires_at: expires_at ?? null, created_at: now } }, 201);
});

adminRoutes.delete("/galleries/:id", async (c) => {
  const { id } = c.req.param();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare("UPDATE galleries SET deleted_at = ? WHERE id = ?")
    .bind(now, id)
    .run();
  return c.json({ ok: true });
});

// Restore a soft-deleted gallery
adminRoutes.post("/galleries/:id/restore", async (c) => {
  const { id } = c.req.param();
  await c.env.DB.prepare("UPDATE galleries SET deleted_at = NULL WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ ok: true });
});

// Permanently delete (removes R2 objects + D1 rows)
adminRoutes.delete("/galleries/:id/permanent", async (c) => {
  const { id } = c.req.param();

  // Get all photos to remove from R2
  const { results: photos } = await c.env.DB.prepare(
    "SELECT r2_key FROM photos WHERE gallery_id = ?"
  )
    .bind(id)
    .all<{ r2_key: string }>();

  // Delete from R2
  await Promise.all(photos.map((p) => c.env.IMAGES_BUCKET.delete(p.r2_key)));

  // D1 cascade handles photos + subscribers deletion
  await c.env.DB.prepare("DELETE FROM galleries WHERE id = ?").bind(id).run();

  return c.json({ ok: true });
});

// Set or unset banner photo
adminRoutes.patch("/galleries/:id/banner", async (c) => {
  const { id } = c.req.param();
  const { photoId } = await c.req.json<{ photoId: string | null }>();

  // Verify photo belongs to this gallery (if setting)
  if (photoId) {
    const photo = await c.env.DB.prepare(
      "SELECT id FROM photos WHERE id = ? AND gallery_id = ?"
    ).bind(photoId, id).first();
    if (!photo) return c.json({ error: "Photo not found in this gallery" }, 404);
  }

  await c.env.DB.prepare("UPDATE galleries SET banner_photo_id = ? WHERE id = ?")
    .bind(photoId ?? null, id)
    .run();
  return c.json({ ok: true });
});

// Toggle public/private
adminRoutes.patch("/galleries/:id/visibility", async (c) => {
  const { id } = c.req.param();
  const { is_public } = await c.req.json<{ is_public: boolean }>();
  await c.env.DB.prepare("UPDATE galleries SET is_public = ? WHERE id = ?")
    .bind(is_public ? 1 : 0, id)
    .run();
  return c.json({ ok: true });
});

// Update general settings (name, description, event_date, expires_at)
adminRoutes.patch("/galleries/:id/settings", async (c) => {
  const { id } = c.req.param();
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

  await c.env.DB.prepare(`UPDATE galleries SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...values, id)
    .run();

  return c.json({ ok: true });
});

// Reset gallery password
adminRoutes.patch("/galleries/:id/password", async (c) => {
  const { id } = c.req.param();
  const { password } = await c.req.json<{ password: string }>();
  if (!password || password.length < 4) {
    return c.json({ error: "Password must be at least 4 characters" }, 400);
  }
  const passwordHash = await pbkdf2Hash(password);
  const result = await c.env.DB.prepare(
    "UPDATE galleries SET password_hash = ? WHERE id = ?"
  )
    .bind(passwordHash, id)
    .run();
  if (!result.meta.changes) return c.json({ error: "Gallery not found" }, 404);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------
// Export: generate pre-signed R2 URLs for all photos in a gallery
// ------------------------------------------------------------------
adminRoutes.get("/galleries/:id/export", async (c) => {
  const { id } = c.req.param();

  const gallery = await c.env.DB.prepare(
    "SELECT id, name, slug FROM galleries WHERE id = ?"
  )
    .bind(id)
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
  const gallery = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.slug, g.is_public, g.banner_photo_id, p.r2_key AS banner_r2_key,
            g.event_date, g.expires_at
     FROM galleries g
     LEFT JOIN photos p ON p.id = g.banner_photo_id
     WHERE g.id = ?`
  )
    .bind(id)
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
// Photos: upload
// ------------------------------------------------------------------
// Photos: upload
// ------------------------------------------------------------------
adminRoutes.post("/galleries/:id/photos", async (c) => {
  const { id } = c.req.param();

  const gallery = await c.env.DB.prepare(
    "SELECT id FROM galleries WHERE id = ?"
  )
    .bind(id)
    .first<{ id: string }>();
  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "No file provided" }, 400);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const photoId = crypto.randomUUID();
  const r2Key = `galleries/${id}/${photoId}.${ext}`;

  // Stream directly to R2 — never buffer full file
  await c.env.IMAGES_BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: file.name,
      galleryId: id,
    },
  });

  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    "INSERT INTO photos (id, gallery_id, r2_key, original_name, size, uploaded_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(photoId, id, r2Key, file.name, file.size, now, now)
    .run();

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

  const gallery = await c.env.DB.prepare(
    "SELECT id, slug FROM galleries WHERE id = ? AND deleted_at IS NULL"
  )
    .bind(id)
    .first<{ id: string; slug: string }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
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

  return c.json({ ok: true, slug: gallery.slug });
});
