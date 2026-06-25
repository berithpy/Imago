import { and, asc, desc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { sign } from "hono/jwt";
import { pbkdf2Hash } from "../lib/crypto";
import { logAdminEvent } from "../lib/adminLog";
import { invitedUserHtml, newPhotosHtml, sendEmail } from "../lib/email";
import {
  canManageMembers,
  ROLES,
  type ActorContext,
} from "../lib/roles";
import {
  adminLog as adminLogTable,
  appConfig,
  galleries,
  galleryAllowedEmails,
  gallerySubscribers,
  member,
  organization,
  photos,
  tenants,
  user,
} from "../lib/schema";
import { RESERVED_GALLERY_SUBPATHS } from "../../shared/reservedSlugs";
import { ServiceError, type ServiceCtx } from "./types";
import { resolveBannerR2Key } from "./galleryService";

const SLUG_RE = /^[a-z0-9-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIEWER_TOKEN_TTL_SECONDS = 60 * 60 * 24;

/**
 * Tenant scope predicate identical to the legacy `tenantClause()` helper:
 * when a tenant id is in scope, restrict to that tenant; otherwise restrict
 * to rows with NULL tenant_id (single-tenant / legacy data path).
 */
function tenantScope(tenantId: string | undefined): SQL {
  return tenantId ? eq(galleries.tenantId, tenantId) : isNull(galleries.tenantId);
}

// ------------------------------------------------------------------
// Slug validation
// ------------------------------------------------------------------

export async function checkGallerySlug(
  ctx: ServiceCtx,
  slug: string,
  tenantId: string | undefined
): Promise<{ valid: boolean; available: boolean; reserved: boolean }> {
  const valid = SLUG_RE.test(slug);
  if (!valid) return { valid: false, available: false, reserved: false };
  const reserved = RESERVED_GALLERY_SUBPATHS.includes(slug);
  if (reserved) return { valid: true, available: false, reserved: true };
  const existing = await ctx.db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.slug, slug), tenantScope(tenantId)))
    .get();
  return { valid: true, available: !existing, reserved: false };
}

// ------------------------------------------------------------------
// List
// ------------------------------------------------------------------

const ADMIN_GALLERY_FIELDS = {
  id: galleries.id,
  name: galleries.name,
  slug: galleries.slug,
  description: galleries.description,
  is_public: galleries.isPublic,
  share_preview_enabled: galleries.sharePreviewEnabled,
  banner_photo_id: galleries.bannerPhotoId,
  event_date: galleries.eventDate,
  expires_at: galleries.expiresAt,
  deleted_at: galleries.deletedAt,
  created_at: galleries.createdAt,
};

const SORT_ORDER_BY: Record<string, SQL> = {
  created_desc: desc(galleries.createdAt),
  created_asc: asc(galleries.createdAt),
  name_asc: asc(galleries.name),
  name_desc: desc(galleries.name),
  event_desc: desc(sql`COALESCE(${galleries.eventDate}, 0)`),
  event_asc: asc(sql`COALESCE(${galleries.eventDate}, 0)`),
};

export async function listGalleriesAdmin(
  ctx: ServiceCtx,
  input: { q: string; sort: string; tenantId: string | undefined }
): Promise<unknown[]> {
  const orderBy = SORT_ORDER_BY[input.sort] ?? desc(galleries.createdAt);
  const conds: SQL[] = [tenantScope(input.tenantId)];
  if (input.q) {
    const pat = `%${input.q}%`;
    const orExpr = or(
      like(galleries.name, pat),
      like(galleries.slug, pat),
      like(galleries.description, pat)
    );
    if (orExpr) conds.push(orExpr);
  }
  const rows = await ctx.db
    .select(ADMIN_GALLERY_FIELDS)
    .from(galleries)
    .where(and(...conds))
    .orderBy(orderBy)
    .all();
  return Promise.all(rows.map(async (row) => ({
    ...row,
    banner_r2_key: await resolveBannerR2Key(ctx, row.id, row.banner_photo_id),
    is_public: row.is_public ? 1 : 0,
    share_preview_enabled: row.share_preview_enabled ? 1 : 0,
  })));
}

// ------------------------------------------------------------------
// Create
// ------------------------------------------------------------------

export type CreateGalleryInput = {
  name: string;
  slug: string;
  password?: string;
  description?: string | null;
  is_public?: boolean;
  event_date?: number | null;
  expires_at?: number | null;
  tenantId: string | undefined;
  actor: ActorContext;
};

export async function createGallery(
  ctx: ServiceCtx,
  input: CreateGalleryInput
): Promise<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: number;
  event_date: number | null;
  expires_at: number | null;
  created_at: number;
}> {
  if (!input.name || !input.slug || (!input.is_public && !input.password)) {
    throw new ServiceError(
      "VALIDATION",
      "name and slug are required; password is required for private galleries"
    );
  }
  if (!SLUG_RE.test(input.slug)) {
    throw new ServiceError(
      "VALIDATION",
      "Slug must only contain lowercase letters, numbers, and dashes"
    );
  }
  if (RESERVED_GALLERY_SUBPATHS.includes(input.slug)) {
    throw new ServiceError("VALIDATION", "Slug is reserved");
  }

  const existing = await ctx.db
    .select({ id: galleries.id })
    .from(galleries)
    .where(eq(galleries.slug, input.slug))
    .get();
  if (existing) throw new ServiceError("CONFLICT", "Slug already in use");

  const id = crypto.randomUUID();
  const passwordHash = await pbkdf2Hash(input.password ?? crypto.randomUUID());
  const now = Math.floor(Date.now() / 1000);

  await ctx.db
    .insert(galleries)
    .values({
      id,
      tenantId: input.tenantId ?? null,
      name: input.name,
      slug: input.slug,
      passwordHash,
      description: input.description ?? null,
      isPublic: !!input.is_public,
      eventDate: input.event_date ?? null,
      expiresAt: input.expires_at ?? null,
      createdAt: now,
    })
    .run();

  await logAdminEvent(ctx.db, "GALLERY_CREATED", {
    detail: input.slug,
    actor: input.actor,
    tenantId: input.tenantId ?? null,
  });

  return {
    id,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    is_public: input.is_public ? 1 : 0,
    event_date: input.event_date ?? null,
    expires_at: input.expires_at ?? null,
    created_at: now,
  };
}

// ------------------------------------------------------------------
// Soft / restore / permanent delete
// ------------------------------------------------------------------

export async function softDeleteGallery(
  ctx: ServiceCtx,
  id: string,
  tenantId: string | undefined
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await ctx.db
    .update(galleries)
    .set({ deletedAt: now })
    .where(and(eq(galleries.id, id), tenantScope(tenantId)))
    .run();
}

export async function restoreGallery(
  ctx: ServiceCtx,
  id: string,
  tenantId: string | undefined
): Promise<void> {
  await ctx.db
    .update(galleries)
    .set({ deletedAt: null })
    .where(and(eq(galleries.id, id), tenantScope(tenantId)))
    .run();
}

export async function permanentDeleteGallery(
  ctx: ServiceCtx,
  input: { id: string; tenantId: string | undefined; actor: ActorContext }
): Promise<void> {
  if (!input.actor.user) throw new ServiceError("UNAUTHORIZED", "Unauthorized");
  if (input.tenantId) {
    const tenantRow = await ctx.db
      .select({ parentId: tenants.parentId })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .get();
    if (!canManageMembers(input.actor, input.tenantId, tenantRow?.parentId ?? null)) {
      throw new ServiceError("FORBIDDEN", "Forbidden");
    }
  } else if (!input.actor.superAdmin) {
    throw new ServiceError("FORBIDDEN", "Forbidden");
  }

  const photoRows = await ctx.db
    .select({ r2Key: photos.r2Key })
    .from(photos)
    .where(eq(photos.galleryId, input.id))
    .all();

  await Promise.all(photoRows.map((p) => ctx.env.IMAGES_BUCKET.delete(p.r2Key)));

  await ctx.db
    .delete(galleries)
    .where(and(eq(galleries.id, input.id), tenantScope(input.tenantId)))
    .run();
}

// ------------------------------------------------------------------
// Banner / visibility / settings / password
// ------------------------------------------------------------------

export async function setBannerPhoto(
  ctx: ServiceCtx,
  input: { galleryId: string; photoId: string | null; tenantId: string | undefined }
): Promise<void> {
  if (input.photoId) {
    const photo = await ctx.db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.id, input.photoId), eq(photos.galleryId, input.galleryId)))
      .get();
    if (!photo) throw new ServiceError("NOT_FOUND", "Photo not found in this gallery");
  }
  await ctx.db
    .update(galleries)
    .set({ bannerPhotoId: input.photoId ?? null })
    .where(and(eq(galleries.id, input.galleryId), tenantScope(input.tenantId)))
    .run();
}

export async function setGalleryVisibility(
  ctx: ServiceCtx,
  input: { id: string; isPublic: boolean; tenantId: string | undefined }
): Promise<void> {
  await ctx.db
    .update(galleries)
    .set({ isPublic: input.isPublic })
    .where(and(eq(galleries.id, input.id), tenantScope(input.tenantId)))
    .run();
}

export type UpdateSettingsInput = {
  id: string;
  tenantId: string | undefined;
  name?: string;
  description?: string | null;
  event_date?: number | null;
  expires_at?: number | null;
  share_preview_enabled?: boolean;
};

export async function updateGallerySettings(
  ctx: ServiceCtx,
  input: UpdateSettingsInput
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.event_date !== undefined) set.eventDate = input.event_date;
  if (input.expires_at !== undefined) set.expiresAt = input.expires_at;
  if (input.share_preview_enabled !== undefined) {
    set.sharePreviewEnabled = input.share_preview_enabled;
  }
  if (Object.keys(set).length === 0) {
    throw new ServiceError("VALIDATION", "Nothing to update");
  }
  await ctx.db
    .update(galleries)
    .set(set)
    .where(and(eq(galleries.id, input.id), tenantScope(input.tenantId)))
    .run();
}

export async function resetGalleryPassword(
  ctx: ServiceCtx,
  input: { id: string; password: string; tenantId: string | undefined }
): Promise<void> {
  if (!input.password || input.password.length < 4) {
    throw new ServiceError("VALIDATION", "Password must be at least 4 characters");
  }
  const passwordHash = await pbkdf2Hash(input.password);
  const result = await ctx.db
    .update(galleries)
    .set({ passwordHash })
    .where(and(eq(galleries.id, input.id), tenantScope(input.tenantId)))
    .run();
  if (!result.meta || result.meta.changes === 0) {
    throw new ServiceError("NOT_FOUND", "Gallery not found");
  }
}

// ------------------------------------------------------------------
// Admin export / lookup-by-slug / list-by-id
// ------------------------------------------------------------------

export async function exportGalleryAdmin(
  ctx: ServiceCtx,
  id: string,
  tenantId: string | undefined
): Promise<{ galleryName: string; photos: { name: string; url: string }[] }> {
  const gallery = await ctx.db
    .select({ id: galleries.id, name: galleries.name })
    .from(galleries)
    .where(and(eq(galleries.id, id), tenantScope(tenantId)))
    .get();
  if (!gallery) throw new ServiceError("NOT_FOUND", "Gallery not found");

  const rows = await ctx.db
    .select({ r2Key: photos.r2Key, originalName: photos.originalName })
    .from(photos)
    .where(eq(photos.galleryId, id))
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

const ADMIN_GALLERY_DETAIL_FIELDS = {
  id: galleries.id,
  name: galleries.name,
  slug: galleries.slug,
  description: galleries.description,
  is_public: galleries.isPublic,
  share_preview_enabled: galleries.sharePreviewEnabled,
  banner_photo_id: galleries.bannerPhotoId,
  event_date: galleries.eventDate,
  expires_at: galleries.expiresAt,
};

const ADMIN_PHOTO_LIST_FIELDS = {
  id: photos.id,
  r2_key: photos.r2Key,
  original_name: photos.originalName,
  size: photos.size,
  uploaded_at: photos.uploadedAt,
};

function coerceAdminGallery(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    is_public: row.is_public ? 1 : 0,
    share_preview_enabled: row.share_preview_enabled ? 1 : 0,
  };
}

export async function getAdminGalleryBySlug(
  ctx: ServiceCtx,
  slug: string,
  tenantId: string | undefined
): Promise<{ gallery: Record<string, unknown>; photos: unknown[] }> {
  const gallery = await ctx.db
    .select(ADMIN_GALLERY_DETAIL_FIELDS)
    .from(galleries)
    .where(and(eq(galleries.slug, slug), isNull(galleries.deletedAt), tenantScope(tenantId)))
    .get();
  if (!gallery) throw new ServiceError("NOT_FOUND", "Gallery not found");
  const banner_r2_key = await resolveBannerR2Key(ctx, gallery.id, gallery.banner_photo_id);

  const photoRows = await ctx.db
    .select(ADMIN_PHOTO_LIST_FIELDS)
    .from(photos)
    .where(eq(photos.galleryId, gallery.id))
    .orderBy(asc(photos.sortOrder), asc(photos.uploadedAt))
    .all();

  return { gallery: coerceAdminGallery({ ...gallery, banner_r2_key }), photos: photoRows };
}

export async function getAdminGalleryById(
  ctx: ServiceCtx,
  id: string,
  tenantId: string | undefined
): Promise<{ gallery: Record<string, unknown>; photos: unknown[] }> {
  // Note: legacy handler intentionally does NOT filter on `deleted_at` here,
  // so the management page can still load soft-deleted galleries. Preserve.
  const gallery = await ctx.db
    .select(ADMIN_GALLERY_DETAIL_FIELDS)
    .from(galleries)
    .where(and(eq(galleries.id, id), tenantScope(tenantId)))
    .get();
  if (!gallery) throw new ServiceError("NOT_FOUND", "Gallery not found");
  const banner_r2_key = await resolveBannerR2Key(ctx, gallery.id, gallery.banner_photo_id);

  const photoRows = await ctx.db
    .select(ADMIN_PHOTO_LIST_FIELDS)
    .from(photos)
    .where(eq(photos.galleryId, id))
    .orderBy(asc(photos.sortOrder), asc(photos.uploadedAt))
    .all();

  return { gallery: coerceAdminGallery({ ...gallery, banner_r2_key }), photos: photoRows };
}

// ------------------------------------------------------------------
// Photos: upload / delete
// ------------------------------------------------------------------

export type UploadPhotoInput = {
  galleryId: string;
  tenantId: string | undefined;
  file: File;
  appOrigin: string;
};

export async function uploadPhoto(
  ctx: ServiceCtx,
  input: UploadPhotoInput
): Promise<{
  id: string;
  r2_key: string;
  original_name: string;
  size: number;
  uploaded_at: number;
  notify: Promise<unknown> | null;
}> {
  if (!input.tenantId) throw new ServiceError("VALIDATION", "Tenant required");

  const gallery = await ctx.db
    .select({
      id: galleries.id,
      name: galleries.name,
      slug: galleries.slug,
      tenantSlug: tenants.slug,
    })
    .from(galleries)
    .innerJoin(tenants, eq(tenants.id, galleries.tenantId))
    .where(and(eq(galleries.id, input.galleryId), eq(galleries.tenantId, input.tenantId)))
    .get();
  if (!gallery) throw new ServiceError("NOT_FOUND", "Gallery not found");

  const ext = input.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const photoId = crypto.randomUUID();
  const r2Key = `${input.tenantId}/galleries/${input.galleryId}/${photoId}.${ext}`;

  await ctx.env.IMAGES_BUCKET.put(r2Key, input.file.stream(), {
    httpMetadata: { contentType: input.file.type },
    customMetadata: {
      originalName: input.file.name,
      galleryId: input.galleryId,
      tenantId: input.tenantId,
    },
  });

  const now = Math.floor(Date.now() / 1000);
  await ctx.db
    .insert(photos)
    .values({
      id: photoId,
      galleryId: input.galleryId,
      r2Key,
      originalName: input.file.name,
      size: input.file.size,
      uploadedAt: now,
      sortOrder: now,
    })
    .run();

  // Best-effort subscriber notification — return the promise so the route
  // hands it to `c.executionCtx.waitUntil()` for non-blocking dispatch.
  const subs = await ctx.db
    .select({ email: gallerySubscribers.email })
    .from(gallerySubscribers)
    .where(
      and(
        eq(gallerySubscribers.galleryId, input.galleryId),
        eq(gallerySubscribers.verified, true)
      )
    )
    .all();

  let notify: Promise<unknown> | null = null;
  if (subs.length > 0) {
    const galleryUrl = `${input.appOrigin}/${gallery.tenantSlug}/${gallery.slug}`;
    notify = Promise.all(
      subs.map((s) =>
        sendEmail(ctx.env.EMAIL, ctx.env.EMAIL_DOMAIN, "notifications", {
          to: s.email,
          subject: `New photo added to ${gallery.name}`,
          html: newPhotosHtml(gallery.name, galleryUrl, 1),
        })
      )
    );
  }

  return {
    id: photoId,
    r2_key: r2Key,
    original_name: input.file.name,
    size: input.file.size,
    uploaded_at: now,
    notify,
  };
}

export async function deletePhoto(
  ctx: ServiceCtx,
  input: { galleryId: string; photoId: string }
): Promise<void> {
  const photo = await ctx.db
    .select({ r2Key: photos.r2Key })
    .from(photos)
    .where(and(eq(photos.id, input.photoId), eq(photos.galleryId, input.galleryId)))
    .get();
  if (!photo) throw new ServiceError("NOT_FOUND", "Photo not found");

  await ctx.env.IMAGES_BUCKET.delete(photo.r2Key);
  await ctx.db.delete(photos).where(eq(photos.id, input.photoId)).run();
}

// ------------------------------------------------------------------
// Viewer bypass token (admin-only)
// ------------------------------------------------------------------

export async function issueViewerBypass(
  ctx: ServiceCtx,
  input: { galleryId: string; tenantId: string | undefined; jwtSecret: string }
): Promise<{ token: string; slug: string; maxAgeSeconds: number }> {
  const gallery = await ctx.db
    .select({ id: galleries.id, slug: galleries.slug, tenantId: galleries.tenantId })
    .from(galleries)
    .where(and(eq(galleries.id, input.galleryId), isNull(galleries.deletedAt), tenantScope(input.tenantId)))
    .get();
  if (!gallery) throw new ServiceError("NOT_FOUND", "Gallery not found");

  const exp = Math.floor(Date.now() / 1000) + VIEWER_TOKEN_TTL_SECONDS;
  const token = await sign(
    {
      sub: "viewer",
      galleryId: gallery.id,
      tenantId: gallery.tenantId,
      auth_method: "admin_bypass",
      exp,
    },
    input.jwtSecret
  );

  return { token, slug: gallery.slug, maxAgeSeconds: VIEWER_TOKEN_TTL_SECONDS };
}

// ------------------------------------------------------------------
// Admin log read
// ------------------------------------------------------------------

export async function listAdminLog(
  ctx: ServiceCtx,
  actor: ActorContext
): Promise<unknown[]> {
  if (!actor.user) throw new ServiceError("UNAUTHORIZED", "Unauthorized");
  if (!actor.superAdmin) throw new ServiceError("FORBIDDEN", "Forbidden");
  const rows = await ctx.db
    .select({
      id: adminLogTable.id,
      event: adminLogTable.event,
      detail: adminLogTable.detail,
      created_at: adminLogTable.createdAt,
    })
    .from(adminLogTable)
    .orderBy(desc(adminLogTable.createdAt))
    .limit(200)
    .all();
  return rows;
}

// ------------------------------------------------------------------
// Per-gallery email whitelist
// ------------------------------------------------------------------

export async function listAllowedEmails(
  ctx: ServiceCtx,
  galleryId: string
): Promise<{ id: string; email: string; added_at: number }[]> {
  const rows = await ctx.db
    .select({
      id: galleryAllowedEmails.id,
      email: galleryAllowedEmails.email,
      added_at: galleryAllowedEmails.addedAt,
    })
    .from(galleryAllowedEmails)
    .where(eq(galleryAllowedEmails.galleryId, galleryId))
    .orderBy(asc(galleryAllowedEmails.addedAt))
    .all();
  return rows;
}

export async function addAllowedEmail(
  ctx: ServiceCtx,
  input: {
    galleryId: string;
    email: string;
    tenantId: string | undefined;
    appOrigin: string;
  }
): Promise<{ id: string }> {
  if (!input.email || !EMAIL_RE.test(input.email)) {
    throw new ServiceError("VALIDATION", "Valid email required");
  }

  const gallery = await ctx.db
    .select({
      id: galleries.id,
      name: galleries.name,
      slug: galleries.slug,
      tenantSlug: tenants.slug,
    })
    .from(galleries)
    .leftJoin(tenants, eq(tenants.id, galleries.tenantId))
    .where(and(eq(galleries.id, input.galleryId), isNull(galleries.deletedAt), tenantScope(input.tenantId)))
    .get();
  if (!gallery) throw new ServiceError("NOT_FOUND", "Gallery not found");

  const entryId = crypto.randomUUID();
  try {
    await ctx.db
      .insert(galleryAllowedEmails)
      .values({
        id: entryId,
        galleryId: input.galleryId,
        email: input.email.trim().toLowerCase(),
      })
      .run();
  } catch {
    throw new ServiceError("CONFLICT", "Email already on the access list");
  }

  const galleryUrl = gallery.tenantSlug
    ? `${input.appOrigin}/${gallery.tenantSlug}/${gallery.slug}`
    : `${input.appOrigin}/${gallery.slug}`;
  await sendEmail(ctx.env.EMAIL, ctx.env.EMAIL_DOMAIN, "invite", {
    to: input.email,
    subject: `You've been invited to view ${gallery.name}`,
    html: invitedUserHtml(gallery.name, galleryUrl, input.email),
  });

  return { id: entryId };
}

export async function removeAllowedEmail(
  ctx: ServiceCtx,
  input: { galleryId: string; email: string }
): Promise<void> {
  await ctx.db
    .delete(galleryAllowedEmails)
    .where(
      and(
        eq(galleryAllowedEmails.galleryId, input.galleryId),
        eq(sql`lower(${galleryAllowedEmails.email})`, input.email.toLowerCase())
      )
    )
    .run();
}

// ------------------------------------------------------------------
// One-time admin setup (creates platform org + first imago_operator)
// ------------------------------------------------------------------

export type AdminSetupInput = {
  email: string;
  password: string;
  name: string;
  recoveryEmail?: string;
};

export async function isAdminConfigured(ctx: ServiceCtx): Promise<boolean> {
  const row = await ctx.db.select({ id: user.id }).from(user).limit(1).get();
  return !!row;
}

/**
 * After the better-auth signup completes, promote the new user to
 * `imago_operator`, ensure the platform org exists, and store the recovery
 * email. Emits `ADMIN_SETUP`. Throws when no user row matches the email.
 */
export async function finalizeAdminSetup(
  ctx: ServiceCtx,
  input: { email: string; recoveryEmail: string | undefined }
): Promise<void> {
  const { ROLES: R, IMAGO_ORG_ID, IMAGO_ORG_SLUG } = await import("../lib/roles");

  const newUser = await ctx.db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, input.email.toLowerCase()))
    .get();

  if (newUser) {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        "INSERT OR IGNORE INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, unixepoch())"
      ).bind(IMAGO_ORG_ID, "Imago Platform", IMAGO_ORG_SLUG),
      ctx.env.DB.prepare(
        "INSERT INTO member (id, userId, organizationId, role, createdAt) VALUES (?, ?, ?, ?, unixepoch())"
      ).bind(crypto.randomUUID(), newUser.id, IMAGO_ORG_ID, R.IMAGO_OPERATOR),
    ]);
  }

  const resolvedRecovery = input.recoveryEmail?.trim() || input.email;
  await ctx.db
    .insert(appConfig)
    .values({ key: "recovery_email", value: resolvedRecovery })
    .onConflictDoUpdate({ target: appConfig.key, set: { value: resolvedRecovery } })
    .run();

  await logAdminEvent(ctx.db, "ADMIN_SETUP", { actorTypeOverride: "system" });
}
