CREATE TABLE `authorization_records` (
	`public_id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`request_reference` text NOT NULL,
	`amount` text NOT NULL,
	`asset` text NOT NULL,
	`receiver_wallet` text NOT NULL,
	`processing_deadline` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_authorization_records_wallet` ON `authorization_records` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `idx_authorization_records_created` ON `authorization_records` (`created_at`);--> statement-breakpoint
CREATE TABLE `authorized_wallets` (
	`wallet_address` text PRIMARY KEY NOT NULL,
	`amount` text NOT NULL,
	`asset` text NOT NULL,
	`receiver_wallet` text NOT NULL,
	`request_reference` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_authorized_wallets_reference` ON `authorized_wallets` (`request_reference`);