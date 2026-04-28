import { Hono } from "hono";
import { Bindings } from "../index";
import { VARIANT_CONFIG } from "./images";

export const ogImageRoutes = new Hono<{ Bindings: Bindings }>();

// ------------------------------------------------------------------
// Public: serve a small webp banner thumbnail for use as the
// Open Graph / Twitter Card image when a gallery URL is shared.
//
// This route bypasses gallery auth and is gated by the per-gallery
// `share_preview_enabled` flag. It only serves galleries that are
// not deleted and not expired. If `banner_photo_id` is unset we fall
// back to the first photo by (sort_order, uploaded_at). Galleries
// with no photos return 404.
// ------------------------------------------------------------------
ogImageRoutes.get("/:tenantSlug/:gallerySlug/image", async (c) => {
  const { tenantSlug, gallerySlug } = c.req.param();
  const now = Math.floor(Date.now() / 1000);

  const gallery = await c.env.DB.prepare(
    `SELECT g.id, g.banner_photo_id, g.tenant_id
     FROM galleries g
     JOIN tenants t ON t.id = g.tenant_id
     WHERE g.slug = ?
       AND t.slug = ?
       AND t.deleted_at IS NULL
       AND g.deleted_at IS NULL
       AND (g.expires_at IS NULL OR g.expires_at > ?)
       AND g.share_preview_enabled = 1`
  )
    .bind(gallerySlug, tenantSlug, now)
    .first<{ id: string; banner_photo_id: string | null; tenant_id: string }>();

  if (!gallery) return c.notFound();

  let r2Key: string | null = null;

  if (gallery.banner_photo_id) {
    const banner = await c.env.DB.prepare(
      "SELECT r2_key FROM photos WHERE id = ? AND gallery_id = ?"
    )
      .bind(gallery.banner_photo_id, gallery.id)
      .first<{ r2_key: string }>();
    r2Key = banner?.r2_key ?? null;
  }

  if (!r2Key) {
    const first = await c.env.DB.prepare(
      "SELECT r2_key FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, uploaded_at ASC, id ASC LIMIT 1"
    )
      .bind(gallery.id)
      .first<{ r2_key: string }>();
    r2Key = first?.r2_key ?? null;
  }

  if (!r2Key) return c.notFound();

  const object = await c.env.IMAGES_BUCKET.get(r2Key);
  if (!object) return c.notFound();

  const config = VARIANT_CONFIG.og;

  try {
    const result = await c.env.IMAGES
      .input(object.body)
      .transform({ width: config.width })
      .output({ format: "image/webp", quality: config.quality });
    const transformed = result.response();

    const headers = new Headers(transformed.headers);
    // Public so social CDNs (Facebook, Twitter, Discord) can cache.
    headers.set("Cache-Control", "public, max-age=86400");
    return new Response(transformed.body, { headers });
  } catch {
    // Local dev fallback: stream the original.
    const fallback = await c.env.IMAGES_BUCKET.get(r2Key);
    if (!fallback) return c.notFound();
    const headers = new Headers();
    fallback.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=86400");
    return new Response(fallback.body, { headers });
  }
});
