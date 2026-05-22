import { and, asc, desc, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import { galleries, photos } from "../lib/schema";
import { ServiceError, type ServiceCtx } from "./types";

/**
 * Tenant-scope predicate used by every public/viewer query: when a tenant
 * context is present, restrict to that tenant; otherwise restrict to rows
 * with a NULL tenant (single-tenant / legacy data).
 */
function tenantPredicate(tenantId: string | undefined): SQL {
  return tenantId ? eq(galleries.tenantId, tenantId) : isNull(galleries.tenantId);
}

export type GalleryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: number;
  banner_photo_id: string | null;
  banner_r2_key: string | null;
  event_date: number | null;
  expires_at: number | null;
  created_at: number;
};

const GALLERY_PUBLIC_FIELDS = {
  id: galleries.id,
  name: galleries.name,
  slug: galleries.slug,
  description: galleries.description,
  is_public: galleries.isPublic,
  banner_photo_id: galleries.bannerPhotoId,
  banner_r2_key: photos.r2Key,
  event_date: galleries.eventDate,
  expires_at: galleries.expiresAt,
  created_at: galleries.createdAt,
};

/**
 * List non-deleted, non-expired galleries visible to the current tenant
 * scope. Banner photo r2 key joined for thumbnail rendering.
 */
export async function listPublicGalleries(
  ctx: ServiceCtx,
  tenantId: string | undefined
): Promise<GalleryListItem[]> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await ctx.db
    .select(GALLERY_PUBLIC_FIELDS)
    .from(galleries)
    .leftJoin(photos, eq(photos.id, galleries.bannerPhotoId))
    .where(
      and(
        isNull(galleries.deletedAt),
        or(isNull(galleries.expiresAt), gt(galleries.expiresAt, now)),
        tenantPredicate(tenantId)
      )
    )
    .orderBy(desc(galleries.createdAt))
    .all();
  return rows.map(coerceListItem);
}

/**
 * Fetch a single public gallery by slug. Throws `NOT_FOUND` if absent and
 * `EXPIRED` (HTTP 410) when the gallery's expiry has passed.
 */
export async function getPublicGallery(
  ctx: ServiceCtx,
  slug: string,
  tenantId: string | undefined
): Promise<GalleryListItem> {
  const row = await ctx.db
    .select(GALLERY_PUBLIC_FIELDS)
    .from(galleries)
    .leftJoin(photos, eq(photos.id, galleries.bannerPhotoId))
    .where(and(eq(galleries.slug, slug), isNull(galleries.deletedAt), tenantPredicate(tenantId)))
    .get();
  if (!row) throw new ServiceError("NOT_FOUND", "Gallery not found");

  const item = coerceListItem(row);
  const now = Math.floor(Date.now() / 1000);
  if (item.expires_at && item.expires_at <= now) {
    throw new ServiceError("EXPIRED", "This gallery has expired");
  }
  return item;
}

/**
 * Resolve gallery id (and name) by slug for tenant scope. Throws
 * `NOT_FOUND` if missing. Used by viewer-protected endpoints to translate
 * slugs to ids before subsequent lookups.
 */
async function resolveGallery(
  ctx: ServiceCtx,
  slug: string,
  tenantId: string | undefined
): Promise<{ id: string; name: string }> {
  const row = await ctx.db
    .select({ id: galleries.id, name: galleries.name })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), isNull(galleries.deletedAt), tenantPredicate(tenantId)))
    .get();
  if (!row) throw new ServiceError("NOT_FOUND", "Gallery not found");
  return row;
}

export type ExportPayload = {
  galleryName: string;
  photos: { name: string; url: string }[];
};

/**
 * Build the export payload for a gallery: ordered list of original
 * filenames with full-resolution image URLs. Caller already verified the
 * viewer JWT (via `requireViewer` middleware).
 */
export async function exportGallery(
  ctx: ServiceCtx,
  slug: string,
  tenantId: string | undefined
): Promise<ExportPayload> {
  const gallery = await resolveGallery(ctx, slug, tenantId);
  const rows = await ctx.db
    .select({
      r2Key: photos.r2Key,
      originalName: photos.originalName,
    })
    .from(photos)
    .where(eq(photos.galleryId, gallery.id))
    .orderBy(asc(photos.sortOrder), asc(photos.uploadedAt))
    .all();

  return {
    galleryName: gallery.name,
    photos: rows.map((p) => ({
      name: p.originalName,
      url: `/api/images/${p.r2Key}?variant=full`,
    })),
  };
}

export type PhotoRow = {
  id: string;
  r2_key: string;
  original_name: string;
  size: number;
  uploaded_at: number;
  sort_order: number;
};

/** Fetch a single photo by id within a gallery (viewer-protected). */
export async function getPhotoById(
  ctx: ServiceCtx,
  slug: string,
  photoId: string,
  tenantId: string | undefined
): Promise<PhotoRow> {
  const gallery = await resolveGallery(ctx, slug, tenantId);
  const row = await ctx.db
    .select({
      id: photos.id,
      r2_key: photos.r2Key,
      original_name: photos.originalName,
      size: photos.size,
      uploaded_at: photos.uploadedAt,
      sort_order: photos.sortOrder,
    })
    .from(photos)
    .where(and(eq(photos.galleryId, gallery.id), eq(photos.id, photoId)))
    .get();
  if (!row) throw new ServiceError("NOT_FOUND", "Photo not found");
  return row;
}

export type PhotoPage = {
  photos: PhotoRow[];
  nextCursor: string | null;
  total: number;
};

/**
 * Paginated photo listing for a gallery (viewer-protected). Uses OFFSET
 * pagination because batch uploads share `sort_order` values and a
 * keyset cursor would skip rows. `cursor` is the offset as a string.
 */
export async function listPhotos(
  ctx: ServiceCtx,
  input: {
    slug: string;
    tenantId: string | undefined;
    cursor: string | undefined;
    limit: number;
  }
): Promise<PhotoPage> {
  const gallery = await resolveGallery(ctx, input.slug, input.tenantId);
  const limit = Math.min(input.limit, 100);
  const offset = input.cursor ? Number(input.cursor) : 0;

  const [rows, totalRow] = await Promise.all([
    ctx.db
      .select({
        id: photos.id,
        r2_key: photos.r2Key,
        original_name: photos.originalName,
        size: photos.size,
        uploaded_at: photos.uploadedAt,
        sort_order: photos.sortOrder,
      })
      .from(photos)
      .where(eq(photos.galleryId, gallery.id))
      .orderBy(asc(photos.sortOrder), asc(photos.id))
      .limit(limit)
      .offset(offset)
      .all(),
    ctx.db
      .select({ total: sql<number>`COUNT(*)` })
      .from(photos)
      .where(eq(photos.galleryId, gallery.id))
      .get(),
  ]);

  const total = totalRow?.total ?? 0;
  const nextCursor = offset + rows.length < total ? String(offset + rows.length) : null;
  return { photos: rows, nextCursor, total };
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Coerce Drizzle's typed result back into the legacy snake_case shape
 * expected by the public API responses. `is_public` round-trips as 0/1
 * for backward compatibility with the original raw-SQL handler. */
function coerceListItem(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  banner_photo_id: string | null;
  banner_r2_key: string | null;
  event_date: number | null;
  expires_at: number | null;
  created_at: number;
}): GalleryListItem {
  return {
    ...row,
    is_public: row.is_public ? 1 : 0,
  };
}

// ------------------------------------------------------------------
// Open Graph / link-preview helpers (used by ogImage + ogPreview routes)
// ------------------------------------------------------------------

import { tenants } from "../lib/schema";

export type OgGallery = {
  id: string;
  bannerPhotoId: string | null;
  tenantId: string | null;
};

/**
 * Look up a gallery for OG image generation: must belong to a non-deleted
 * tenant by slug, be non-deleted, non-expired, and have
 * `share_preview_enabled = true`. Returns `null` if any condition fails so
 * the route can `c.notFound()`.
 */
export async function getShareableGalleryForImage(
  ctx: ServiceCtx,
  tenantSlug: string,
  gallerySlug: string
): Promise<OgGallery | null> {
  const now = Math.floor(Date.now() / 1000);
  const row = await ctx.db
    .select({
      id: galleries.id,
      bannerPhotoId: galleries.bannerPhotoId,
      tenantId: galleries.tenantId,
    })
    .from(galleries)
    .innerJoin(tenants, eq(tenants.id, galleries.tenantId))
    .where(
      and(
        eq(galleries.slug, gallerySlug),
        eq(tenants.slug, tenantSlug),
        isNull(tenants.deletedAt),
        isNull(galleries.deletedAt),
        or(isNull(galleries.expiresAt), gt(galleries.expiresAt, now)),
        eq(galleries.sharePreviewEnabled, true)
      )
    )
    .get();
  return row ?? null;
}

/**
 * Resolve the R2 key for a gallery's social-preview banner. Prefers the
 * explicit `banner_photo_id`; falls back to the first photo by
 * `(sort_order, uploaded_at, id)`. Returns `null` for empty galleries.
 */
export async function resolveBannerR2Key(
  ctx: ServiceCtx,
  galleryId: string,
  bannerPhotoId: string | null
): Promise<string | null> {
  if (bannerPhotoId) {
    const banner = await ctx.db
      .select({ r2Key: photos.r2Key })
      .from(photos)
      .where(and(eq(photos.id, bannerPhotoId), eq(photos.galleryId, galleryId)))
      .get();
    if (banner?.r2Key) return banner.r2Key;
  }

  const first = await ctx.db
    .select({ r2Key: photos.r2Key })
    .from(photos)
    .where(eq(photos.galleryId, galleryId))
    .orderBy(asc(photos.sortOrder), asc(photos.uploadedAt), asc(photos.id))
    .limit(1)
    .get();
  return first?.r2Key ?? null;
}

export type GalleryPreviewMeta = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  sharePreviewEnabled: boolean;
  bannerPhotoId: string | null;
  hasPhotos: boolean;
  tenantName: string;
};

/**
 * Fetch the gallery metadata needed to render OG/Twitter Card tags during
 * the SPA fallthrough. Returns `null` when the gallery doesn't exist, is
 * deleted, or is expired. Callers must additionally filter on
 * `sharePreviewEnabled` before exposing private gallery metadata.
 */
export async function getGalleryPreview(
  ctx: ServiceCtx,
  tenantSlug: string,
  gallerySlug: string
): Promise<GalleryPreviewMeta | null> {
  const now = Math.floor(Date.now() / 1000);
  const row = await ctx.db
    .select({
      id: galleries.id,
      name: galleries.name,
      description: galleries.description,
      isPublic: galleries.isPublic,
      sharePreviewEnabled: galleries.sharePreviewEnabled,
      bannerPhotoId: galleries.bannerPhotoId,
      tenantName: tenants.name,
      hasPhotos: sql<number>`EXISTS(SELECT 1 FROM photos p WHERE p.gallery_id = ${galleries.id})`,
    })
    .from(galleries)
    .innerJoin(tenants, eq(tenants.id, galleries.tenantId))
    .where(
      and(
        eq(galleries.slug, gallerySlug),
        eq(tenants.slug, tenantSlug),
        isNull(tenants.deletedAt),
        isNull(galleries.deletedAt),
        or(isNull(galleries.expiresAt), gt(galleries.expiresAt, now))
      )
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    isPublic: !!row.isPublic,
    sharePreviewEnabled: !!row.sharePreviewEnabled,
    hasPhotos: !!row.hasPhotos,
  };
}