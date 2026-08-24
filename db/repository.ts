import { env } from 'cloudflare:workers';
import {
  DEFAULT_AUTHORIZED_WALLET,
  isValidTronAddress,
} from '@/lib/verification';

export type ChallengeRow = {
  id: string;
  wallet_address: string;
  origin: string;
  message: string;
  display_message: string;
  expires_at: number;
  used_at: number | null;
  created_at: number;
};

type VerificationRow = {
  wallet_address: string;
  challenge_id: string;
  signature_hash: string;
  verified_at: number;
};

export type SettlementRow = {
  wallet_address: string;
  network_status: string;
  txid: string | null;
  submitted_at: number | null;
  confirmed_at: number | null;
  credited_at: number | null;
  updated_at: number;
};

let databaseReady: Promise<void> | undefined;

function getDatabase(): D1Database {
  if (!env.DB) {
    throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  }
  return env.DB;
}

async function initializeDatabase() {
  const database = getDatabase();

  await database.batch([
    database.prepare(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS signature_challenges (
        id TEXT PRIMARY KEY NOT NULL,
        wallet_address TEXT NOT NULL,
        origin TEXT NOT NULL,
        message TEXT NOT NULL,
        display_message TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `),
    database.prepare(`
      CREATE INDEX IF NOT EXISTS idx_signature_challenges_wallet_expiry
      ON signature_challenges(wallet_address, expires_at)
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS verified_signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        wallet_address TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        signature_hash TEXT NOT NULL,
        verified_at INTEGER NOT NULL
      )
    `),
    database.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_signatures_wallet
      ON verified_signatures(wallet_address)
    `),
    database.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_signatures_challenge
      ON verified_signatures(challenge_id)
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS network_settlements (
        wallet_address TEXT PRIMARY KEY NOT NULL,
        network_status TEXT DEFAULT 'validation_pending' NOT NULL,
        txid TEXT,
        submitted_at INTEGER,
        confirmed_at INTEGER,
        credited_at INTEGER,
        updated_at INTEGER NOT NULL
      )
    `),
    database.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_network_settlements_txid
      ON network_settlements(txid)
    `),
  ]);

  await database.prepare('PRAGMA optimize').run();
}

export async function ensureDatabase() {
  databaseReady ??= initializeDatabase();
  await databaseReady;
}

export async function getAuthorizedWallet(): Promise<string> {
  await ensureDatabase();
  const database = getDatabase();
  const runtimeWallet = env.AUTHORIZED_WALLET_ADDRESS?.trim();
  const configuredWallet = runtimeWallet || DEFAULT_AUTHORIZED_WALLET;

  if (!isValidTronAddress(configuredWallet)) {
    throw new Error('AUTHORIZED_WALLET_ADDRESS is not a valid TRON address.');
  }

  if (runtimeWallet) {
    await database
      .prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('authorized_wallet', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `)
      .bind(runtimeWallet, Date.now())
      .run();
  } else {
    await database
      .prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('authorized_wallet', ?, ?)
        ON CONFLICT(key) DO NOTHING
      `)
      .bind(DEFAULT_AUTHORIZED_WALLET, Date.now())
      .run();
  }

  const row = await database
    .prepare("SELECT value FROM app_settings WHERE key = 'authorized_wallet' LIMIT 1")
    .first<{ value: string }>();

  if (!row || !isValidTronAddress(row.value)) {
    throw new Error('The stored authorized wallet is invalid.');
  }

  return row.value;
}

export async function getVerification(walletAddress: string): Promise<VerificationRow | null> {
  await ensureDatabase();
  return await getDatabase()
    .prepare(`
      SELECT wallet_address, challenge_id, signature_hash, verified_at
      FROM verified_signatures
      WHERE wallet_address = ?
      LIMIT 1
    `)
    .bind(walletAddress)
    .first<VerificationRow>();
}

export async function getSettlement(walletAddress: string): Promise<SettlementRow | null> {
  await ensureDatabase();
  return await getDatabase()
    .prepare(`
      SELECT wallet_address, network_status, txid, submitted_at, confirmed_at, credited_at, updated_at
      FROM network_settlements
      WHERE wallet_address = ?
      LIMIT 1
    `)
    .bind(walletAddress)
    .first<SettlementRow>();
}

export async function getActiveChallenge(walletAddress: string, now: number): Promise<ChallengeRow | null> {
  await ensureDatabase();
  return await getDatabase()
    .prepare(`
      SELECT id, wallet_address, origin, message, display_message, expires_at, used_at, created_at
      FROM signature_challenges
      WHERE wallet_address = ? AND used_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(walletAddress, now)
    .first<ChallengeRow>();
}

export async function insertChallenge(challenge: ChallengeRow) {
  await ensureDatabase();
  const database = getDatabase();
  const cleanupBefore = challenge.created_at - 24 * 60 * 60 * 1000;

  await database.batch([
    database
      .prepare('DELETE FROM signature_challenges WHERE expires_at < ?')
      .bind(cleanupBefore),
    database
      .prepare(`
        INSERT INTO signature_challenges (
          id, wallet_address, origin, message, display_message, expires_at, used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
      `)
      .bind(
        challenge.id,
        challenge.wallet_address,
        challenge.origin,
        challenge.message,
        challenge.display_message,
        challenge.expires_at,
        challenge.created_at,
      ),
  ]);
}

export async function getChallenge(id: string): Promise<ChallengeRow | null> {
  await ensureDatabase();
  return await getDatabase()
    .prepare(`
      SELECT id, wallet_address, origin, message, display_message, expires_at, used_at, created_at
      FROM signature_challenges
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first<ChallengeRow>();
}

export async function recordVerification(params: {
  challengeId: string;
  walletAddress: string;
  signatureHash: string;
  verifiedAt: number;
}) {
  await ensureDatabase();
  const database = getDatabase();
  const results = await database.batch([
    database
      .prepare(`
        UPDATE signature_challenges
        SET used_at = ?
        WHERE id = ? AND used_at IS NULL AND expires_at >= ?
      `)
      .bind(params.verifiedAt, params.challengeId, params.verifiedAt),
    database
      .prepare(`
        INSERT INTO verified_signatures (
          wallet_address, challenge_id, signature_hash, verified_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(wallet_address) DO NOTHING
      `)
      .bind(
        params.walletAddress,
        params.challengeId,
        params.signatureHash,
        params.verifiedAt,
      ),
    database
      .prepare(`
        INSERT INTO network_settlements (
          wallet_address, network_status, txid, submitted_at, confirmed_at, credited_at, updated_at
        ) VALUES (?, 'validation_pending', NULL, NULL, NULL, NULL, ?)
        ON CONFLICT(wallet_address) DO NOTHING
      `)
      .bind(params.walletAddress, params.verifiedAt),
  ]);

  return Number(results[0]?.meta?.changes ?? 0) === 1;
}
