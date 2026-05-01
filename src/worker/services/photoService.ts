import { and, eq, isNull } from "drizzle-orm";
import { galleries, photos } from "../lib/schema";
import { type ServiceCtx } from "./types";

export type PhotoGalleryLookup = {
  galleryId: string;
  isPublic: boolean;
  tenantId: string | null;
};

/**
 * Resolve the gallery a given R2 key belongs to. Returns `null` when the
 * key isn't tracked by any non-deleted gallery (the route falls back to
 * normal auth in that case to preserve the historic 401 behavior for
 * unknown keys without a session).
 */
export async function lookupPhotoGallery(
  ctx: ServiceCtx,
  r2Key: string
): Promise<PhotoGalleryLookup | null> {
  const row = await ctx.db
    .select({
      galleryId: galleries.id,
      isPublic: galleries.isPublic,
      tenantId: galleries.tenantId,
    })
    .from(photos)
    .innerJoin(galleries, eq(galleries.id, photos.galleryId))
    .where(and(eq(photos.r2Key, r2Key), isNull(galleries.deletedAt)))
    .get();
  return row ? { ...row, isPublic: !!row.isPublic } : null;
}

/**
 * Fetch the tenant id for a non-deleted gallery. Used by the image route
 * to verify a viewer JWT is scoped to the same tenant as the requested
 * R2 key.
 */
export async function getGalleryTenantId(
  ctx: ServiceCtx,
  galleryId: string
): Promise<string | null | undefined> {
  const row = await ctx.db
    .select({ tenantId: galleries.tenantId })
    .from(galleries)
    .where(and(eq(galleries.id, galleryId), isNull(galleries.deletedAt)))
    .get();
  return row?.tenantId;
}
