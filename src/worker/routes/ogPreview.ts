import { Hono } from "hono";
import { Bindings } from "../index";
import { getDb } from "../lib/db";
import { getGalleryPreview } from "../services/galleryService";

export const ogPreviewRoutes = new Hono<{ Bindings: Bindings }>();

// Reserved top-level paths under /:tenantSlug/:gallerySlug that are NOT a
// gallery view (and so must skip preview lookup). Right now only `login`,
// but kept as a set for easy extension.
const RESERVED_GALLERY_SUBPATHS = new Set(["login"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Truncate descriptions for OG/Twitter (keep social previews terse).
function truncate(value: string, max = 200): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
}

type GalleryPreview = {
  id: string;
  name: string;
  description: string | null;
  is_public: number;
  share_preview_enabled: number;
  banner_photo_id: string | null;
  has_photos: number;
  tenant_name: string;
};
// (Type retained for parity with prior API; populated from service struct below.)

// ------------------------------------------------------------------
// SPA fallthrough handler. Matches every non-/api request that the
// asset pipeline would otherwise serve as `index.html`. We:
//   1. Always proxy through to ASSETS.fetch to get the SPA shell.
//   2. If the URL is a gallery view we know about, inject per-gallery
//      OG/Twitter meta tags via HTMLRewriter.
//   3. Otherwise, the response passes through unchanged so non-gallery
//      pages keep the static generic Imago preview from index.html.
// ------------------------------------------------------------------
ogPreviewRoutes.all("*", async (c) => {
  const url = new URL(c.req.url);
  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);

  // Only rewrite HTML responses (the SPA fallback). Static assets pass through.
  const contentType = assetResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return assetResponse;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return assetResponse;

  const [tenantSlug, gallerySlug, maybeSubpath] = segments;
  if (maybeSubpath && RESERVED_GALLERY_SUBPATHS.has(maybeSubpath)) {
    return assetResponse;
  }

  const preview = await getGalleryPreview(
    { env: c.env, db: getDb(c.env), actor: null },
    tenantSlug,
    gallerySlug
  );
  if (!preview) return assetResponse;
  // Private galleries without explicit opt-in stay generic — no leak.
  if (!preview.sharePreviewEnabled) return assetResponse;

  // Re-shape into the legacy snake_case struct used by the rest of the
  // handler so the HTML rewriting code below remains untouched.
  const gallery: GalleryPreview = {
    id: preview.id,
    name: preview.name,
    description: preview.description,
    is_public: preview.isPublic ? 1 : 0,
    share_preview_enabled: preview.sharePreviewEnabled ? 1 : 0,
    banner_photo_id: preview.bannerPhotoId,
    has_photos: preview.hasPhotos ? 1 : 0,
    tenant_name: preview.tenantName,
  };

  const appUrl = (c.env.APP_URL ?? `${url.protocol}//${url.host}`).replace(/\/$/, "");
  const canonicalUrl = `${appUrl}/${tenantSlug}/${gallerySlug}`;
  const title = `${gallery.name} — ${gallery.tenant_name}`;
  const description = gallery.description?.trim()
    ? truncate(gallery.description.trim())
    : `View the ${gallery.name} gallery on ${gallery.tenant_name}.`;
  const imageUrl = gallery.has_photos
    ? `${appUrl}/api/og/${tenantSlug}/${gallerySlug}/image`
    : null;

  const metaTags: string[] = [
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:site_name" content="${escapeHtml(gallery.tenant_name)}">`,
    `<meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="description" content="${escapeHtml(description)}">`,
  ];

  if (imageUrl) {
    metaTags.push(
      `<meta property="og:image" content="${escapeHtml(imageUrl)}">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`,
    );
  }

  const escapedTitle = escapeHtml(title);
  const metaBlock = metaTags.join("\n    ");

  // Selectors for the static fallback tags in index.html that we want to
  // strip when injecting gallery-specific replacements (so unfurls don't see
  // duplicate og:title / twitter:title etc.).
  const META_SELECTORS_TO_STRIP = [
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:type"]',
    'meta[property="og:url"]',
    'meta[property="og:site_name"]',
    'meta[property="og:image"]',
    'meta[property="og:image:width"]',
    'meta[property="og:image:height"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:image"]',
  ];

  // Use the native streaming HTMLRewriter when available (workerd/Cloudflare).
  // Fall back to a small string-based rewrite for Node (tests, local tooling).
  if (typeof HTMLRewriter !== "undefined") {
    let rewriter = new HTMLRewriter()
      .on("title", {
        element(el) {
          el.setInnerContent(escapedTitle);
        },
      })
      .on("head", {
        element(el) {
          el.append(metaBlock, { html: true });
        },
      });

    for (const selector of META_SELECTORS_TO_STRIP) {
      rewriter = rewriter.on(selector, {
        element(el) {
          el.remove();
        },
      });
    }

    const rewritten = rewriter.transform(assetResponse);
    const headers = new Headers(rewritten.headers);
    headers.delete("etag");
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(rewritten.body, {
      status: rewritten.status,
      headers,
    });
  }

  const sourceHtml = await assetResponse.text();
  const withTitle = sourceHtml.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapedTitle}</title>`
  );
  // Strip the static fallback meta tags so we don't end up with duplicates.
  const stripped = withTitle.replace(
    /\s*<meta\s+(?:name|property)="(?:description|og:[a-z_:]+|twitter:[a-z]+)"[^>]*>/gi,
    ""
  );
  const withMeta = stripped.replace(
    /<\/head>/i,
    `    ${metaBlock}\n  </head>`
  );
  const headers = new Headers(assetResponse.headers);
  headers.delete("etag");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(withMeta, {
    status: assetResponse.status,
    headers,
  });
});
