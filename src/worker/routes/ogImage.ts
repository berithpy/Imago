import { Hono } from "hono";
import { Bindings } from "../index";
import { getDb } from "../lib/db";
import {
  getShareableGalleryForImage,
  resolveBannerR2Key,
} from "../services/galleryService";
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
  const svcCtx = { env: c.env, db: getDb(c.env), actor: null };

  const gallery = await getShareableGalleryForImage(svcCtx, tenantSlug, gallerySlug);
  if (!gallery) return c.notFound();

  const r2Key = await resolveBannerR2Key(svcCtx, gallery.id, gallery.bannerPhotoId);
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
