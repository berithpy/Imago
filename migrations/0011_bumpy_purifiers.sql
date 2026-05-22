-- Migrate "super-admin" from a user-level boolean flag to membership in a
-- platform-wide organization. After this migration:
--   * The "imago" organization holds all platform operators.
--   * A user is an Imago operator iff they have a `member` row in this org
--     with role = 'imago_operator'.
--   * The legacy `user.is_super_admin` column is gone.
--
-- The DDL drop at the bottom was auto-generated; the DML above was added by
-- hand to backfill data before the column disappears. Idempotent: re-running
-- is safe because of INSERT OR IGNORE / NOT EXISTS.

INSERT OR IGNORE INTO `organization` (id, name, slug, createdAt)
VALUES ('imago-platform', 'Imago Platform', 'imago', unixepoch());
--> statement-breakpoint
INSERT INTO `member` (id, userId, organizationId, role, createdAt)
SELECT lower(hex(randomblob(16))),
       u.id,
       'imago-platform',
       'imago_operator',
       unixepoch()
FROM `user` u
WHERE u.is_super_admin = 1
  AND NOT EXISTS (
    SELECT 1 FROM `member` m
    WHERE m.userId = u.id AND m.organizationId = 'imago-platform'
  );
--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `is_super_admin`;