ALTER TABLE `tenants` ADD `organization_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `is_super_admin` integer DEFAULT false NOT NULL;