-- Migration: 0001_initial_schema
-- App tables for Imago gallery app
-- Note: better-auth manages its own tables (user, session, account, verification)

PRAGMA foreign_keys = ON;

-- Galleries table
CREATE TABLE IF NOT EXISTS galleries (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  description  TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_galleries_slug ON galleries(slug);

-- Photos table
CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  gallery_id    TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  r2_key        TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size          INTEGER NOT NULL DEFAULT 0,
  uploaded_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_photos_gallery_id ON photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_photos_gallery_sort ON photos(gallery_id, sort_order, uploaded_at);

-- Gallery subscribers (email notification opt-in — future feature)
CREATE TABLE IF NOT EXISTS gallery_subscribers (
  id         TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  verified   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(gallery_id, email)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_gallery ON gallery_subscribers(gallery_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_token ON gallery_subscribers(token);
