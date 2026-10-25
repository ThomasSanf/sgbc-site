PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`total` integer NOT NULL,
	`currency` text NOT NULL,
	`shipping_fee` integer DEFAULT 0 NOT NULL,
	`payment_provider` text DEFAULT 'stripe' NOT NULL,
	`payment_environment` text DEFAULT 'live' NOT NULL,
	`ecpay_merchant_id` text,
	`ecpay_merchant_trade_no` text,
	`ecpay_trade_no` text,
	`ecpay_payment_code` text,
	`locale` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`stripe_session_id` text,
	`payment_intent_id` text,
	`refunded_amount` integer DEFAULT 0 NOT NULL,
	`tracking_number` text DEFAULT '' NOT NULL,
	`shipping_address` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_total_valid" CHECK("__new_orders"."quantity" > 0 AND "__new_orders"."shipping_fee" >= 0 AND "__new_orders"."total" = "__new_orders"."unit_price" * "__new_orders"."quantity" + "__new_orders"."shipping_fee")
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "request_key", "product_id", "product_name", "sku", "name", "email", "quantity", "unit_price", "total", "currency", "status", "stripe_session_id", "payment_intent_id", "refunded_amount", "tracking_number", "shipping_address", "created_at", "updated_at") SELECT "id", "request_key", "product_id", "product_name", "sku", "name", "email", "quantity", "unit_price", "total", "currency", "status", "stripe_session_id", "payment_intent_id", "refunded_amount", "tracking_number", "shipping_address", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_request_key_unique` ON `orders` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_ecpay_merchant_trade_no_unique` ON `orders` (`ecpay_merchant_trade_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_ecpay_trade_no_unique` ON `orders` (`ecpay_trade_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_session_id_unique` ON `orders` (`stripe_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payment_intent_id_unique` ON `orders` (`payment_intent_id`);--> statement-breakpoint
CREATE INDEX `order_created_idx` ON `orders` (`created_at`);--> statement-breakpoint
ALTER TABLE `settings` ADD `shipping_fee_per_unit` integer;