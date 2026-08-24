CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signature_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`origin` text NOT NULL,
	`message` text NOT NULL,
	`display_message` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_signature_challenges_wallet_expiry` ON `signature_challenges` (`wallet_address`,`expires_at`);--> statement-breakpoint
CREATE TABLE `verified_signatures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wallet_address` text NOT NULL,
	`challenge_id` text NOT NULL,
	`signature_hash` text NOT NULL,
	`verified_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_verified_signatures_wallet` ON `verified_signatures` (`wallet_address`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_verified_signatures_challenge` ON `verified_signatures` (`challenge_id`);