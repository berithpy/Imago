CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `admin_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text NOT NULL,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_log_created` ON `admin_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`password_hash` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT false NOT NULL,
	`banner_photo_id` text,
	`deleted_at` integer,
	`event_date` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `galleries_slug_unique` ON `galleries` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_galleries_slug` ON `galleries` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_galleries_deleted` ON `galleries` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_galleries_expires` ON `galleries` (`expires_at`);--> statement-breakpoint
CREATE TABLE `gallery_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_subscribers_token_unique` ON `gallery_subscribers` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_subscribers_gallery_email` ON `gallery_subscribers` (`gallery_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_subscribers_gallery` ON `gallery_subscribers` (`gallery_id`);--> statement-breakpoint
CREATE INDEX `idx_subscribers_token` ON `gallery_subscribers` (`token`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`original_name` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_photos_gallery_id` ON `photos` (`gallery_id`);--> statement-breakpoint
CREATE INDEX `idx_photos_gallery_sort` ON `photos` (`gallery_id`,`sort_order`,`uploaded_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch())
);
