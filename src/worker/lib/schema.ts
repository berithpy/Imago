import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ------------------------------------------------------------------
// Better-auth tables (managed by better-auth, reflected here for Drizzle)
// ------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  // Added by better-auth organization plugin
  activeOrganizationId: text("activeOrganizationId"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// ------------------------------------------------------------------
// Better-auth organization plugin tables
// ------------------------------------------------------------------

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organizationId").notNull().references(() => organization.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  inviterId: text("inviterId").notNull().references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organizationId").notNull().references(() => organization.id, { onDelete: "cascade" }),
  role: text("role"),
  status: text("status").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// ------------------------------------------------------------------
// App tables
// ------------------------------------------------------------------

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  organizationId: text("organization_id"),
  // Sub-tenancy: nullable FK to a parent tenant. One level deep is enforced
  // in the service layer (no DB CHECK) — see canCreateSubTenant in roles.ts.
  parentId: text("parent_id"),
  // JSON blob for sub-tenant branding overrides. Null = inherit parent.
  brandingOverrides: text("branding_overrides"),
  deletedAt: integer("deleted_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("idx_tenants_slug").on(t.slug),
  index("idx_tenants_parent").on(t.parentId),
]);

export const galleries = sqliteTable("galleries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  description: text("description"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  // When true, allow public link-preview unfurls (OG/Twitter Card meta tags +
  // banner thumbnail) for this gallery, even if it is private. Default false;
  // backfill sets true for existing public galleries (see migration 0007).
  sharePreviewEnabled: integer("share_preview_enabled", { mode: "boolean" }).notNull().default(false),
  // Nullable FK to photos.id — no DDL constraint to avoid circular dependency
  bannerPhotoId: text("banner_photo_id"),
  deletedAt: integer("deleted_at"),
  eventDate: integer("event_date"),
  expiresAt: integer("expires_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("idx_galleries_slug").on(t.slug),
  index("idx_galleries_deleted").on(t.deletedAt),
  index("idx_galleries_expires").on(t.expiresAt),
  index("idx_galleries_tenant").on(t.tenantId),
]);

export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(),
  galleryId: text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  r2Key: text("r2_key").notNull(),
  originalName: text("original_name").notNull(),
  size: integer("size").notNull().default(0),
  uploadedAt: integer("uploaded_at").notNull().default(sql`(unixepoch())`),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  index("idx_photos_gallery_id").on(t.galleryId),
  index("idx_photos_gallery_sort").on(t.galleryId, t.sortOrder, t.uploadedAt),
]);

export const gallerySubscribers = sqliteTable("gallery_subscribers", {
  id: text("id").primaryKey(),
  galleryId: text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("idx_subscribers_gallery_email").on(t.galleryId, t.email),
  index("idx_subscribers_gallery").on(t.galleryId),
  index("idx_subscribers_token").on(t.token),
]);

export const adminLog = sqliteTable("admin_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  event: text("event").notNull(),
  detail: text("detail"),
  // 'system' | 'imago_operator' | 'tenant_operator' | 'sub_tenant_operator'
  // | 'tenant_collaborator' | 'parent_operator'
  actorType: text("actor_type").notNull().default("system"),
  actorUserId: text("actor_user_id"),
  // Tenant the action affected (nullable for platform-level events)
  tenantId: text("tenant_id"),
  // For parent-operator / imago-operator writes into a sub-tenant: the
  // sub-tenant id so the affected tenant can see it in its own log view.
  visibleToTenantId: text("visible_to_tenant_id"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("idx_admin_log_created").on(t.createdAt),
  index("idx_admin_log_tenant").on(t.tenantId),
  index("idx_admin_log_visible").on(t.visibleToTenantId),
]);

export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const galleryAllowedEmails = sqliteTable("gallery_allowed_emails", {
  id: text("id").primaryKey(),
  galleryId: text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  addedAt: integer("added_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("idx_allowed_gallery_email").on(t.galleryId, t.email),
  index("idx_allowed_emails_gallery").on(t.galleryId),
]);

// Public-landing-page interest signups (waitlist). Emails are normalized to
// lowercase + trimmed before insert; uniqueness is enforced at the DB level
// so the POST handler can be idempotent.
export const interestSignups = sqliteTable("interest_signups", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  source: text("source").notNull().default("landing"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("idx_interest_signups_email").on(t.email),
]);
