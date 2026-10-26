CREATE TABLE `wishlist` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`locale` text NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_email_unique` ON `wishlist` (`email`);--> statement-breakpoint
CREATE INDEX `wishlist_created_idx` ON `wishlist` (`created_at`);