import { and, eq, isNull, sql } from "drizzle-orm";
import { sign } from "hono/jwt";
import { auth } from "../lib/auth";
import { pbkdf2Verify } from "../lib/crypto";
import { galleries, galleryAllowedEmails } from "../lib/schema";
import { ServiceError, type ServiceCtx } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIEWER_TOKEN_TTL_SECONDS = 60 * 60 * 24;

export type ViewerLoginResult = {
  /** Signed JWT to set as `viewer_token` cookie. */
  token: string;
  /** TTL in seconds, mirrors the JWT exp claim. */
  maxAgeSeconds: number;
};

/**
 * Verify a gallery password and issue a viewer JWT. Public galleries
 * skip the password check entirely. Throws `NOT_FOUND` for unknown
 * (or soft-deleted) galleries, `VALIDATION` when a password is missing
 * for a private gallery, and `UNAUTHORIZED` on a mismatch.
 */
export async function loginToGallery(
  ctx: ServiceCtx,
  input: { slug: string; tenantId?: string; password: string | undefined; jwtSecret: string }
): Promise<ViewerLoginResult> {
  const gallery = await ctx.db
    .select({
      id: galleries.id,
      tenantId: galleries.tenantId,
      passwordHash: galleries.passwordHash,
      isPublic: galleries.isPublic,
      name: galleries.name,
    })
    .from(galleries)
    .where(
      input.tenantId
        ? and(
            eq(galleries.slug, input.slug),
            isNull(galleries.deletedAt),
            eq(galleries.tenantId, input.tenantId)
          )
        : and(eq(galleries.slug, input.slug), isNull(galleries.deletedAt))
    )
    .get();

  if (!gallery) throw new ServiceError("NOT_FOUND", "Gallery not found");

  if (!gallery.isPublic) {
    if (!input.password) throw new ServiceError("VALIDATION", "Password required");
    const valid = await pbkdf2Verify(input.password, gallery.passwordHash);
    if (!valid) throw new ServiceError("UNAUTHORIZED", "Invalid password");
  }

  const exp = Math.floor(Date.now() / 1000) + VIEWER_TOKEN_TTL_SECONDS;
  const token = await sign(
    {
      sub: "viewer",
      galleryId: gallery.id,
      tenantId: gallery.tenantId,
      auth_method: "password",
      exp,
    },
    input.jwtSecret
  );

  return { token, maxAgeSeconds: VIEWER_TOKEN_TTL_SECONDS };
}

/**
 * Send a viewer magic link to an email present on the gallery's allow-list.
 * Throws `VALIDATION` for malformed email, `NOT_FOUND` for unknown gallery,
 * `FORBIDDEN` when the email is not whitelisted. Returns the safe callback
 * URL the link should land on.
 */
export async function requestViewerMagicLink(
  ctx: ServiceCtx,
  input: {
    slug: string;
    tenantId?: string;
    rawEmail: string | undefined;
    callbackPath: string | undefined;
    appOrigin: string;
    requestHeaders: Headers;
  }
): Promise<void> {
  const email = input.rawEmail ?? "";
  if (!email || !EMAIL_RE.test(email)) {
    throw new ServiceError("VALIDATION", "Valid email required");
  }

  const gallery = await ctx.db
    .select({ id: galleries.id, name: galleries.name })
    .from(galleries)
    .where(
      input.tenantId
        ? and(
            eq(galleries.slug, input.slug),
            isNull(galleries.deletedAt),
            eq(galleries.tenantId, input.tenantId)
          )
        : and(eq(galleries.slug, input.slug), isNull(galleries.deletedAt))
    )
    .get();

  if (!gallery) throw new ServiceError("NOT_FOUND", "Gallery not found");

  const normalised = email.trim().toLowerCase();
  const allowed = await ctx.db
    .select({ id: galleryAllowedEmails.id })
    .from(galleryAllowedEmails)
    .where(
      and(
        eq(galleryAllowedEmails.galleryId, gallery.id),
        eq(sql`lower(${galleryAllowedEmails.email})`, normalised)
      )
    )
    .get();

  if (!allowed) throw new ServiceError("FORBIDDEN", "Email not on access list");

  const defaultCallback = `/gallery/${input.slug}`;
  const safeCallback =
    input.callbackPath &&
    input.callbackPath.startsWith(defaultCallback) &&
    !input.callbackPath.startsWith("//")
      ? input.callbackPath
      : defaultCallback;

  await auth(ctx.env, input.appOrigin).api.signInMagicLink({
    body: { email: normalised, callbackURL: safeCallback },
    headers: input.requestHeaders,
  });
}
