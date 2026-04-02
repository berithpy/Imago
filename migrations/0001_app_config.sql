CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gallery_allowed_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`email` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_allowed_gallery_email` ON `gallery_allowed_emails` (`gallery_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_allowed_emails_gallery` ON `gallery_allowed_emails` (`gallery_id`);
