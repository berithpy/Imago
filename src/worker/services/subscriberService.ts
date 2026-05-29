import { and, eq, isNull } from "drizzle-orm";
import { galleries, gallerySubscribers } from "../lib/schema";
import {
  sendEmail,
  subscriptionConfirmationHtml,
  subscriptionConfirmedHtml,
  unsubscribeConfirmedHtml,
} from "../lib/email";
import { interestSignups } from "../lib/schema";
import { ServiceError, type ServiceCtx } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;

export type RecordInterestResult = {
  alreadyRegistered: boolean;
};

/**
 * Idempotent landing-page waitlist capture. Normalizes the email to a
 * trimmed lowercase form, validates shape, and inserts a row if absent.
 *
 * Throws `VALIDATION` for malformed input. Returns `alreadyRegistered`
 * when the email is already on the list — never throws on duplicates so
 * the route stays idempotent for the public caller.
 */
export async function recordInterest(
  ctx: ServiceCtx,
  rawEmail: unknown,
  source: string = "landing"
): Promise<RecordInterestResult> {
  if (typeof rawEmail !== "string") {
    throw new ServiceError("VALIDATION", "Email required");
  }
  const email = rawEmail.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    throw new ServiceError("VALIDATION", "Valid email required");
  }

  const existing = await ctx.db
    .select({ id: interestSignups.id })
    .from(interestSignups)
    .where(eq(interestSignups.email, email))
    .get();

  if (existing) {
    return { alreadyRegistered: true };
  }

  await ctx.db.insert(interestSignups).values({
    id: crypto.randomUUID(),
    email,
    source,
  });

  return { alreadyRegistered: false };
}

// ------------------------------------------------------------------
// Gallery subscriptions (double opt-in)
// ------------------------------------------------------------------

export type SubscribeResult = {
  /** Token used in the confirmation email. Reused on re-subscribe. */
  confirmToken: string;
  galleryName: string;
  email: string;
  /** True when the subscriber row already existed. */
  alreadySubscribed: boolean;
};

/**
 * Begin or resume a gallery subscription. Looks up the gallery (optionally
 * tenant-scoped), inserts an unverified subscriber row if absent, and
 * dispatches the confirmation email. Throws `VALIDATION` for bad email
 * and `NOT_FOUND` when the gallery does not exist within the tenant scope.
 *
 * The `appOrigin` is the URL origin used to build the confirmation link;
 * the route extracts this from `c.req.raw.url`.
 */
export async function subscribeToGallery(
  ctx: ServiceCtx,
  input: {
    slug: string;
    tenantId?: string;
    rawEmail: unknown;
    appOrigin: string;
  }
): Promise<SubscribeResult> {
  if (typeof input.rawEmail !== "string" || !EMAIL_RE.test(input.rawEmail)) {
    throw new ServiceError("VALIDATION", "Valid email required");
  }
  const email = input.rawEmail;

  const gallery = await ctx.db
    .select({ id: galleries.id, name: galleries.name })
    .from(galleries)
    .where(
      input.tenantId
        ? and(eq(galleries.slug, input.slug), eq(galleries.tenantId, input.tenantId))
        : eq(galleries.slug, input.slug)
    )
    .get();

  if (!gallery) {
    throw new ServiceError("NOT_FOUND", "Gallery not found");
  }

  const existing = await ctx.db
    .select({ token: gallerySubscribers.token })
    .from(gallerySubscribers)
    .where(
      and(eq(gallerySubscribers.galleryId, gallery.id), eq(gallerySubscribers.email, email))
    )
    .get();

  let confirmToken: string;
  let alreadySubscribed: boolean;
  if (existing) {
    confirmToken = existing.token;
    alreadySubscribed = true;
  } else {
    confirmToken = crypto.randomUUID();
    alreadySubscribed = false;
    await ctx.db.insert(gallerySubscribers).values({
      id: crypto.randomUUID(),
      galleryId: gallery.id,
      email,
      token: confirmToken,
      verified: false,
    });
  }

  const confirmUrl = `${input.appOrigin}/api/subscribe/confirm?token=${encodeURIComponent(confirmToken)}`;
  await sendEmail(ctx.env.EMAIL, ctx.env.EMAIL_DOMAIN, "notifications", {
    to: email,
    subject: `Confirm your subscription to ${gallery.name}`,
    html: subscriptionConfirmationHtml(gallery.name, confirmUrl),
  });

  return { confirmToken, galleryName: gallery.name, email, alreadySubscribed };
}

/**
 * Confirm a pending subscription via opt-in token. Throws `VALIDATION`
 * when the token is missing, already confirmed, or does not match a row.
 * On success, dispatches the post-confirmation email.
 */
export async function confirmSubscription(
  ctx: ServiceCtx,
  token: string | null | undefined
): Promise<{ galleryName: string; email: string }> {
  if (!token) {
    throw new ServiceError("VALIDATION", "Token required");
  }

  const subscriber = await ctx.db
    .select({
      email: gallerySubscribers.email,
      galleryName: galleries.name,
    })
    .from(gallerySubscribers)
    .innerJoin(galleries, eq(galleries.id, gallerySubscribers.galleryId))
    .where(and(eq(gallerySubscribers.token, token), eq(gallerySubscribers.verified, false)))
    .get();

  const result = await ctx.db
    .update(gallerySubscribers)
    .set({ verified: true })
    .where(and(eq(gallerySubscribers.token, token), eq(gallerySubscribers.verified, false)))
    .run();

  if (result.meta.changes === 0) {
    throw new ServiceError("VALIDATION", "Invalid or already confirmed token");
  }

  // `subscriber` is guaranteed non-null when changes > 0, but TypeScript
  // can't see the link; assert for the email dispatch.
  if (!subscriber) {
    throw new ServiceError("INTERNAL", "Subscriber row vanished mid-confirm");
  }

  await sendEmail(ctx.env.EMAIL, ctx.env.EMAIL_DOMAIN, "notifications", {
    to: subscriber.email,
    subject: `You're subscribed to ${subscriber.galleryName}`,
    html: subscriptionConfirmedHtml(subscriber.galleryName),
  });

  return { galleryName: subscriber.galleryName, email: subscriber.email };
}

/**
 * Unsubscribe via token. Throws `VALIDATION` when token is missing.
 * Idempotent — succeeds silently if the row is already gone — but only
 * sends the confirmation email when a subscriber row actually existed.
 */
export async function unsubscribeFromGallery(
  ctx: ServiceCtx,
  token: string | null | undefined
): Promise<void> {
  if (!token) {
    throw new ServiceError("VALIDATION", "Token required");
  }

  const subscriber = await ctx.db
    .select({
      email: gallerySubscribers.email,
      galleryName: galleries.name,
    })
    .from(gallerySubscribers)
    .innerJoin(galleries, eq(galleries.id, gallerySubscribers.galleryId))
    .where(eq(gallerySubscribers.token, token))
    .get();

  await ctx.db.delete(gallerySubscribers).where(eq(gallerySubscribers.token, token));

  if (subscriber) {
    await sendEmail(ctx.env.EMAIL, ctx.env.EMAIL_DOMAIN, "notifications", {
      to: subscriber.email,
      subject: `Unsubscribed from ${subscriber.galleryName}`,
      html: unsubscribeConfirmedHtml(subscriber.galleryName),
    });
  }
}

// `isNull` re-export silences "imported but unused" if removed; keep for
// future deleted_at filter when subscribe gains soft-delete awareness.
void isNull;
