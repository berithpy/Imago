export const SITE_META_DEFAULTS = {
  siteName: "Imago",
  description: "Imago - hosted photo galleries",
  ogDescription: "Hosted photo galleries.",
  ogImagePath: "/og-default.png",
} as const;

export type PageMetadata = {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogTitle: string;
  ogDescription: string;
  ogType: "website";
  ogSiteName: string;
  ogUrl?: string;
  ogImage?: string;
  twitterCard: "summary" | "summary_large_image";
  twitterTitle: string;
  twitterDescription: string;
  twitterImage?: string;
};

type GalleryMetadataParams = {
  galleryName?: string | null;
  gallerySlug?: string;
  tenantName?: string | null;
  routeBase: string;
  origin?: string;
  bannerKey?: string | null;
};

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getOrigin(explicitOrigin?: string): string {
  if (explicitOrigin) return stripTrailingSlash(explicitOrigin);
  if (typeof window !== "undefined" && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return "";
}

function toAbsoluteUrl(pathOrUrl: string | undefined, origin: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!origin) return pathOrUrl;
  return `${origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function buildGalleryUrl(routeBase: string, gallerySlug: string | undefined, origin: string): string | undefined {
  if (!gallerySlug) return undefined;
  const normalizedBase = routeBase.endsWith("/") ? routeBase.slice(0, -1) : routeBase;
  return toAbsoluteUrl(`${normalizedBase}/${gallerySlug}`, origin);
}

export function createDefaultPageMetadata(origin?: string): PageMetadata {
  const resolvedOrigin = getOrigin(origin);
  const ogImage = toAbsoluteUrl(SITE_META_DEFAULTS.ogImagePath, resolvedOrigin);

  return {
    title: SITE_META_DEFAULTS.siteName,
    description: SITE_META_DEFAULTS.description,
    ogTitle: SITE_META_DEFAULTS.siteName,
    ogDescription: SITE_META_DEFAULTS.ogDescription,
    ogType: "website",
    ogSiteName: SITE_META_DEFAULTS.siteName,
    ogImage,
    twitterCard: ogImage ? "summary_large_image" : "summary",
    twitterTitle: SITE_META_DEFAULTS.siteName,
    twitterDescription: SITE_META_DEFAULTS.ogDescription,
    twitterImage: ogImage,
  };
}

export function buildGalleryViewMetadata(params: GalleryMetadataParams): PageMetadata {
  const defaults = createDefaultPageMetadata(params.origin);
  const name = params.galleryName?.trim();
  if (!name) return defaults;

  const resolvedOrigin = getOrigin(params.origin);
  const tenantLabel = params.tenantName?.trim() || SITE_META_DEFAULTS.siteName;
  const canonicalUrl = buildGalleryUrl(params.routeBase, params.gallerySlug, resolvedOrigin);
  const title = `${name} - ${tenantLabel}`;
  const description = `View the ${name} gallery on ${tenantLabel}.`;
  const ogImage = params.bannerKey
    ? toAbsoluteUrl(`/api/images/${params.bannerKey}?variant=banner`, resolvedOrigin)
    : defaults.ogImage;

  return {
    title,
    description,
    canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogType: "website",
    ogSiteName: tenantLabel,
    ogUrl: canonicalUrl,
    ogImage,
    twitterCard: ogImage ? "summary_large_image" : "summary",
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
  };
}

export function buildGalleryLoginMetadata(params: GalleryMetadataParams): PageMetadata {
  const defaults = createDefaultPageMetadata(params.origin);
  const name = params.galleryName?.trim();
  if (!name) return defaults;

  const resolvedOrigin = getOrigin(params.origin);
  const tenantLabel = params.tenantName?.trim() || SITE_META_DEFAULTS.siteName;
  const canonicalUrl = buildGalleryUrl(params.routeBase, params.gallerySlug, resolvedOrigin);
  const title = `${name} - Sign in`;
  const description = `Sign in to access the ${name} gallery on ${tenantLabel}.`;
  const ogImage = defaults.ogImage;

  return {
    title,
    description,
    canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogType: "website",
    ogSiteName: tenantLabel,
    ogUrl: canonicalUrl,
    ogImage,
    twitterCard: ogImage ? "summary_large_image" : "summary",
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
  };
}