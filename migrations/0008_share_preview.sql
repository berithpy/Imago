-- Backfill: existing public galleries get link previews enabled by default.
-- The column is added by 0007_known_wendell_rand.sql (auto-generated).
UPDATE `galleries` SET `share_preview_enabled` = 1 WHERE `is_public` = 1;
