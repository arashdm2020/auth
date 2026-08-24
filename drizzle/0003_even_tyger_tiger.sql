PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_network_settlements` (
	`wallet_address` text PRIMARY KEY NOT NULL,
	`network_status` text DEFAULT 'awaiting_broadcast' NOT NULL,
	`txid` text,
	`submitted_at` integer,
	`confirmed_at` integer,
	`credited_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_network_settlements`("wallet_address", "network_status", "txid", "submitted_at", "confirmed_at", "credited_at", "updated_at") SELECT "wallet_address", "network_status", "txid", "submitted_at", "confirmed_at", "credited_at", "updated_at" FROM `network_settlements`;--> statement-breakpoint
DROP TABLE `network_settlements`;--> statement-breakpoint
ALTER TABLE `__new_network_settlements` RENAME TO `network_settlements`;--> statement-breakpoint
UPDATE `network_settlements` SET `network_status` = 'awaiting_broadcast' WHERE `network_status` = 'validation_pending';--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_network_settlements_txid` ON `network_settlements` (`txid`);
