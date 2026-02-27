import { Hono } from "hono";
import { Bindings } from "../index";
import { requireViewer } from "../middleware/auth";

export const galleryRoutes = new Hono<{ Bindings: Bindings }>();

// ------------------------------------------------------------------
// Public: list galleries (names + slugs only, no photos)
// ------------------------------------------------------------------
galleryRoutes.get("/", async (c) => {
  const now = Math.floor(Date.now() / 1000);
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.slug, g.description, g.is_public, g.banner_photo_id, p.r2_key AS banner_r2_key,
            g.event_date, g.expires_at, g.created_at
     FROM galleries g
     LEFT JOIN photos p ON p.id = g.banner_photo_id
     WHERE g.deleted_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > ?)
     ORDER BY g.created_at DESC`
  ).bind(now).all<{ id: string; name: string; slug: string; description: string | null; is_public: number; banner_photo_id: string | null; banner_r2_key: string | null; event_date: number | null; expires_at: number | null; created_at: number }>();

  return c.json({ galleries: results });
});

// ------------------------------------------------------------------
// Public: get a single gallery's metadata (no photos, no password hash)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug", async (c) => {
  const { slug } = c.req.param();
  const gallery = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.slug, g.description, g.is_public, g.banner_photo_id, p.r2_key AS banner_r2_key,
            g.event_date, g.expires_at, g.created_at
     FROM galleries g
     LEFT JOIN photos p ON p.id = g.banner_photo_id
     WHERE g.slug = ? AND g.deleted_at IS NULL`
  )
    .bind(slug)
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

  const gallery = await c.env.DB.prepare(
    "SELECT id, name FROM galleries WHERE slug = ? AND deleted_at IS NULL"
  )
    .bind(slug)
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
// Protected: list photos in a gallery (viewer JWT required)
// ------------------------------------------------------------------
galleryRoutes.get("/:slug/photos", requireViewer as any, async (c) => {
  const { slug } = c.req.param();
  const cursor = c.req.query("cursor");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);

  const gallery = await c.env.DB.prepare(
    "SELECT id FROM galleries WHERE slug = ? AND deleted_at IS NULL"
  )
    .bind(slug)
    .first<{ id: string }>();

  if (!gallery) return c.json({ error: "Gallery not found" }, 404);

  // Build paginated query
  let query: string;
  let params: (string | number)[];

  if (cursor) {
    query =
      "SELECT id, r2_key, original_name, size, uploaded_at, sort_order FROM photos WHERE gallery_id = ? AND sort_order > ? ORDER BY sort_order ASC, uploaded_at ASC LIMIT ?";
    params = [gallery.id, Number(cursor), limit];
  } else {
    query =
      "SELECT id, r2_key, original_name, size, uploaded_at, sort_order FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, uploaded_at ASC LIMIT ?";
    params = [gallery.id, limit];
  }

  const { results } = await c.env.DB.prepare(query)
    .bind(...params)
    .all<{
      id: string;
      r2_key: string;
      original_name: string;
      size: number;
      uploaded_at: number;
      sort_order: number;
    }>();

  const nextCursor =
    results.length === limit
      ? String(results[results.length - 1].sort_order)
      : null;

  return c.json({ photos: results, nextCursor });
});
