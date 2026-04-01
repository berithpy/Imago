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
// App tables
// ------------------------------------------------------------------

export const galleries = sqliteTable("galleries", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  description: text("description"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
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
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("idx_admin_log_created").on(t.createdAt),
]);
