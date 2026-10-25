CREATE TABLE `embedded_checkouts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`token` text,
	`expires_at` integer NOT NULL,
	`payment_started_at` integer,
	`redirect_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `ecpay_integration` text DEFAULT 'aio' NOT NULL;