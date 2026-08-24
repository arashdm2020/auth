import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const authorizedWallets = sqliteTable(
  'authorized_wallets',
  {
    walletAddress: text('wallet_address').primaryKey(),
    amount: text('amount').notNull(),
    asset: text('asset').notNull(),
    receiverWallet: text('receiver_wallet').notNull(),
    requestReference: text('request_reference').notNull(),
    active: integer('active').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_authorized_wallets_reference').on(table.requestReference),
  ],
);

export const signatureChallenges = sqliteTable(
  'signature_challenges',
  {
    id: text('id').primaryKey(),
    walletAddress: text('wallet_address').notNull(),
    origin: text('origin').notNull(),
    message: text('message').notNull(),
    displayMessage: text('display_message').notNull(),
    expiresAt: integer('expires_at').notNull(),
    usedAt: integer('used_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_signature_challenges_wallet_expiry').on(table.walletAddress, table.expiresAt),
  ],
);

export const verifiedSignatures = sqliteTable(
  'verified_signatures',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    walletAddress: text('wallet_address').notNull(),
    challengeId: text('challenge_id').notNull(),
    signatureHash: text('signature_hash').notNull(),
    verifiedAt: integer('verified_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_verified_signatures_wallet').on(table.walletAddress),
    uniqueIndex('idx_verified_signatures_challenge').on(table.challengeId),
  ],
);

export const networkSettlements = sqliteTable(
  'network_settlements',
  {
    walletAddress: text('wallet_address').primaryKey(),
    networkStatus: text('network_status').notNull().default('awaiting_broadcast'),
    txid: text('txid'),
    submittedAt: integer('submitted_at'),
    confirmedAt: integer('confirmed_at'),
    creditedAt: integer('credited_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_network_settlements_txid').on(table.txid)],
);

export const authorizationRecords = sqliteTable(
  'authorization_records',
  {
    publicId: text('public_id').primaryKey(),
    walletAddress: text('wallet_address').notNull(),
    requestReference: text('request_reference').notNull(),
    amount: text('amount').notNull(),
    asset: text('asset').notNull(),
    receiverWallet: text('receiver_wallet').notNull(),
    processingDeadline: integer('processing_deadline').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_authorization_records_wallet').on(table.walletAddress),
    index('idx_authorization_records_created').on(table.createdAt),
  ],
);
