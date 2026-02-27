-- Migration: 0003_gallery_features
-- Adds soft-delete, hero banner, and public gallery support

PRAGMA foreign_keys = ON;

-- Soft delete: non-null means the gallery is hidden from viewers
ALTER TABLE galleries ADD COLUMN deleted_at INTEGER DEFAULT NULL;

-- Hero banner: FK to a photo in this gallery (nullable)
ALTER TABLE galleries ADD COLUMN banner_photo_id TEXT DEFAULT NULL;

-- Public galleries: skip password requirement when 1
ALTER TABLE galleries ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_galleries_deleted ON galleries(deleted_at);
