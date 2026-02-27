import { Hono } from "hono";
import { Bindings } from "../index";
import { requireViewer } from "../middleware/auth";

export const imageRoutes = new Hono<{ Bindings: Bindings }>();

const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_QUALITY = 85;

// ------------------------------------------------------------------
// Protected: serve an image from R2, transformed via Cloudflare Images
// Query params: ?variant=thumb (default) | full
// ------------------------------------------------------------------
imageRoutes.get("/:key{.+}", requireViewer as any, async (c) => {
  const key = c.req.param("key");
  const variant = c.req.query("variant") ?? "thumb";

  const object = await c.env.IMAGES_BUCKET.get(key);
  if (!object) return c.notFound();

  const isFull = variant === "full";

  if (isFull) {
    // Serve original, streaming directly
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "private, max-age=86400");
    return new Response(object.body, { headers });
  }

  // Serve thumbnail via Cloudflare Images binding
  try {
    const result = await c.env.IMAGES
      .input(object.body)
      .transform({ width: THUMBNAIL_WIDTH })
      .output({ format: "image/webp", quality: THUMBNAIL_QUALITY });
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
