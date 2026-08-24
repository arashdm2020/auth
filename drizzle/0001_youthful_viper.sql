CREATE TABLE `network_settlements` (
	`wallet_address` text PRIMARY KEY NOT NULL,
	`network_status` text DEFAULT 'validation_pending' NOT NULL,
	`txid` text,
	`submitted_at` integer,
	`confirmed_at` integer,
	`credited_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_network_settlements_txid` ON `network_settlements` (`txid`);