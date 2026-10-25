CREATE TABLE `analytics_state` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visitor_days` (
	`day` text NOT NULL,
	`visitor_hash` text NOT NULL,
	PRIMARY KEY(`day`, `visitor_hash`)
);
