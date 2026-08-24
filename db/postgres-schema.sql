CREATE TABLE IF NOT EXISTS authorized_wallets (
  wallet_address TEXT PRIMARY KEY,
  amount TEXT NOT NULL,
  asset TEXT NOT NULL,
  receiver_wallet TEXT NOT NULL,
  request_reference TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS signature_challenges (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  origin TEXT NOT NULL,
  message TEXT NOT NULL,
  display_message TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signature_challenges_wallet_expiry
ON signature_challenges(wallet_address, expires_at);

CREATE TABLE IF NOT EXISTS verified_signatures (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  challenge_id TEXT NOT NULL UNIQUE,
  signature_hash TEXT NOT NULL,
  verified_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS network_settlements (
  wallet_address TEXT PRIMARY KEY,
  network_status TEXT NOT NULL DEFAULT 'awaiting_broadcast',
  txid TEXT UNIQUE,
  submitted_at BIGINT,
  confirmed_at BIGINT,
  credited_at BIGINT,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS authorization_records (
  public_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  request_reference TEXT NOT NULL,
  amount TEXT NOT NULL,
  asset TEXT NOT NULL,
  receiver_wallet TEXT NOT NULL,
  processing_deadline BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_authorization_records_created
ON authorization_records(created_at);
