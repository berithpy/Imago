import { Hono } from "hono";
import { Bindings } from "../index";
import { requireViewer } from "../middleware/auth";
import { tenantClause } from "../lib/db";
import type { TenantVariables } from "../middleware/tenant";

export const galleryRoutes = new Hono<{ Bindings: Bindings; Variables: TenantVariables }>();

// ------------------------------------------------------------------
// Public: list galleries (names + slugs only, no photos)
// ------------------------------------------------------------------
galleryRoutes.get("/", async (c) => {
  const tenantId: string | undefined = c.get("tenantId");
  const [tSql, tBindings] = tenantClause(tenantId);
  const now = Math.floor(Date.now() / 1000);
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.slug, g.description, g.is_public, g.banner_photo_id, p.r2_key AS banner_r2_key,
            g.event_date, g.expires_at, g.created_at
     FROM galleries g
     LEFT JOIN photos p ON p.id = g.banner_photo_id
     WHERE g.deleted_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > ?)${tSql}
     ORDER BY g.created_at DESC`
  ).bind(now, ...tBindings).all<{ id: string; name: string; slug: string; description: string | null; is_public: number; banner_photo_id: string | null; banner_r2_key: string | null; event_date: number | null; expires_at: number | null; created_at: number }>();

  return c.json({ galleries: results });
});

// ------------------------------------------------------------------
// Public: get a single gallery's metadata (no photos, no password hash)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug", async (c) => {
  const { slug } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const gallery = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.slug, g.description, g.is_public, g.banner_photo_id, p.r2_key AS banner_r2_key,
            g.event_date, g.expires_at, g.created_at
     FROM galleries g
     LEFT JOIN photos p ON p.id = g.banner_photo_id
     WHERE g.slug = ? AND g.deleted_at IS NULL${tSql}`
  )
    .bind(slug, ...tBindings)
    .first<{ id: string; name: string; slug: string; description: string | null; is_public: number; banner_photo_id: string | null; banner_r2_key: string | null; event_date: number | null; expires_at: number | null; created_at: number }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const now = Math.floor(Date.now() / 1000);
  if (gallery.expires_at && gallery.expires_at <= now) {
    return c.json({ error: "This gallery has expired" }, 410);
  }

  return c.json({ gallery });
});

// ------------------------------------------------------------------
// Protected: export gallery — pre-signed R2 URLs (viewer JWT required)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug/export", requireViewer as any, async (c) => {
  const { slug } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));

  const gallery = await c.env.DB.prepare(
    `SELECT id, name FROM galleries WHERE slug = ? AND deleted_at IS NULL${tSql}`
  )
    .bind(slug, ...tBindings)
    .first<{ id: string; name: string }>();
  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const { results: photoRows } = await c.env.DB.prepare(
    "SELECT id, r2_key, original_name FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, uploaded_at ASC"
  )
    .bind(gallery.id)
    .all<{ id: string; r2_key: string; original_name: string }>();

  const photoList = photoRows.map((p) => ({
    name: p.original_name,
    url: `/api/images/${p.r2_key}?variant=full`,
  }));

  return c.json({ galleryName: gallery.name, photos: photoList });
});

// ------------------------------------------------------------------
// Protected: fetch a single photo by id (viewer JWT required)
// Useful for deep-linking to a photo that may not be in the first page.
// ------------------------------------------------------------------
galleryRoutes.get("/:slug/photos/:photoId", requireViewer as any, async (c) => {
  const { slug, photoId } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));

  const gallery = await c.env.DB.prepare(
    `SELECT id FROM galleries WHERE slug = ? AND deleted_at IS NULL${tSql}`
  )
    .bind(slug, ...tBindings)
    .first<{ id: string }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  const photo = await c.env.DB.prepare(
    "SELECT id, r2_key, original_name, size, uploaded_at, sort_order FROM photos WHERE gallery_id = ? AND id = ?"
  )
    .bind(gallery.id, photoId)
    .first<{
      id: string;
      r2_key: string;
      original_name: string;
      size: number;
      uploaded_at: number;
      sort_order: number;
    }>();

  if (!photo) return c.json({ error: "Photo not found" }, 404);

  return c.json({ photo });
});

// ------------------------------------------------------------------
// Protected: list photos in a gallery (viewer JWT required)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug/photos", requireViewer as any, async (c) => {
  const { slug } = c.req.param();
  const [tSql, tBindings] = tenantClause(c.get("tenantId"));
  const cursor = c.req.query("cursor");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);

  const gallery = await c.env.DB.prepare(
    `SELECT id FROM galleries WHERE slug = ? AND deleted_at IS NULL${tSql}`
  )
    .bind(slug, ...tBindings)
    .first<{ id: string }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  // Build paginated query using OFFSET to handle duplicate sort_order values (batch uploads)
  const offset = cursor ? Number(cursor) : 0;

  const [{ results }, countRow] = await Promise.all([
    c.env.DB.prepare(
      "SELECT id, r2_key, original_name, size, uploaded_at, sort_order FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?"
    )
      .bind(gallery.id, limit, offset)
      .all<{
        id: string;
        r2_key: string;
        original_name: string;
        size: number;
        uploaded_at: number;
        sort_order: number;
      }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS total FROM photos WHERE gallery_id = ?")
      .bind(gallery.id)
      .first<{ total: number }>(),
  ]);

  const nextCursor =
    offset + results.length < (countRow?.total ?? 0)
      ? String(offset + results.length)
      : null;

  return c.json({ photos: results, nextCursor, total: countRow?.total ?? 0 });
});
