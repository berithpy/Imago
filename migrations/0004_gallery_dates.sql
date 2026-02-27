-- Migration: 0004_gallery_dates
-- Adds event date and expiration date to galleries

PRAGMA foreign_keys = ON;

-- Date the event/shoot took place (display only, unix timestamp)
ALTER TABLE galleries ADD COLUMN event_date INTEGER DEFAULT NULL;

-- When the gallery automatically expires and becomes hidden (unix timestamp)
-- NULL means never expires
ALTER TABLE galleries ADD COLUMN expires_at INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_galleries_expires ON galleries(expires_at);
