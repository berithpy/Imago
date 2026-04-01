import { Hono } from "hono";
import { Bindings } from "../index";
import { requireViewerOrAdmin } from "../middleware/auth";

export const imageRoutes = new Hono<{ Bindings: Bindings }>();

// Dimensions and quality per variant
const VARIANT_CONFIG: Record<string, { width: number; quality: number }> = {
  thumb: { width: 800, quality: 85 },
  banner: { width: 2400, quality: 90 },
  preview: { width: 2000, quality: 90 },
};

// ------------------------------------------------------------------
// Protected: serve an image from R2, transformed via Cloudflare Images
// Query params: ?variant=thumb (default) | banner | preview | full
// ------------------------------------------------------------------
imageRoutes.get("/:key{.+}", requireViewerOrAdmin as any, async (c) => {
  const key = c.req.param("key");
  const variant = c.req.query("variant") ?? "thumb";

  const object = await c.env.IMAGES_BUCKET.get(key);
  if (!object) return c.notFound();

  if (variant === "full") {
    // Serve original, streaming directly
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "private, max-age=86400");
    return new Response(object.body, { headers });
  }

  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.thumb;

  // Serve transformed image via Cloudflare Images binding
  try {
    const result = await c.env.IMAGES
      .input(object.body)
      .transform({ width: config.width })
      .output({ format: "image/webp", quality: config.quality });
    const transformed = result.response();

    const headers = new Headers(transformed.headers);
    headers.set("Cache-Control", "private, max-age=86400");
    return new Response(transformed.body, { headers });
  } catch {
    // Fallback: serve original if Images binding fails (e.g. local dev)
    const fallbackHeaders = new Headers();
    object.writeHttpMetadata(fallbackHeaders);
    fallbackHeaders.set("Cache-Control", "private, max-age=86400");
    // Re-fetch since body was consumed
    const fallback = await c.env.IMAGES_BUCKET.get(key);
    if (!fallback) return c.notFound();
    return new Response(fallback.body, { headers: fallbackHeaders });
  }
});
