ALTER TABLE `admin_log` ADD `actor_type` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_log` ADD `actor_user_id` text;--> statement-breakpoint
ALTER TABLE `admin_log` ADD `tenant_id` text;--> statement-breakpoint
ALTER TABLE `admin_log` ADD `visible_to_tenant_id` text;--> statement-breakpoint
CREATE INDEX `idx_admin_log_tenant` ON `admin_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_log_visible` ON `admin_log` (`visible_to_tenant_id`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `branding_overrides` text;--> statement-breakpoint
CREATE INDEX `idx_tenants_parent` ON `tenants` (`parent_id`);