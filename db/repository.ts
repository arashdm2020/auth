import { env } from 'cloudflare:workers';
import {
  getConfiguredWalletRequests,
  PROCESSING_WINDOW_MS,
  type ConfiguredWalletRequest,
} from '@/lib/runtime-config';

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

export type AuthorizedRequestRow = {
  wallet_address: string;
  amount: string;
  asset: string;
  receiver_wallet: string;
  request_reference: string;
  active: number;
  created_at: number;
  updated_at: number;
};

export type VerificationRow = {
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

export type AuthorizationRecordRow = {
  public_id: string;
  wallet_address: string;
  request_reference: string;
  amount: string;
  asset: string;
  receiver_wallet: string;
  processing_deadline: number;
  created_at: number;
};

export type AuthorizationStatusRow = AuthorizationRecordRow & {
  verified_at: number;
  network_status: string;
  txid: string | null;
  submitted_at: number | null;
  confirmed_at: number | null;
  credited_at: number | null;
  updated_at: number;
};

let databaseReady: Promise<void> | undefined;

function getDatabase(): D1Database {
  if (!env.DB) throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  return env.DB;
}
function configuredWalletStatement(database: D1Database, request: ConfiguredWalletRequest, now: number) {
  return database
    .prepare(`
      INSERT INTO authorized_wallets (
        wallet_address, amount, asset, receiver_wallet, request_reference, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        amount = excluded.amount,
        asset = excluded.asset,
        receiver_wallet = excluded.receiver_wallet,
        request_reference = excluded.request_reference,
        active = 1,
        updated_at = excluded.updated_at
    `)
    .bind(
      request.walletAddress,
      request.amount,
      request.asset,
      request.receiverWallet,
      request.requestReference,
      now,
      now,
    );
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
      CREATE TABLE IF NOT EXISTS authorized_wallets (
        wallet_address TEXT PRIMARY KEY NOT NULL,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        receiver_wallet TEXT NOT NULL,
        request_reference TEXT NOT NULL,
        active INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    database.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_authorized_wallets_reference
      ON authorized_wallets(request_reference)
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
        network_status TEXT DEFAULT 'awaiting_broadcast' NOT NULL,
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
    database.prepare(`
      CREATE TABLE IF NOT EXISTS authorization_records (
        public_id TEXT PRIMARY KEY NOT NULL,
        wallet_address TEXT NOT NULL,
        request_reference TEXT NOT NULL,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        receiver_wallet TEXT NOT NULL,
        processing_deadline INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    database.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_authorization_records_wallet
      ON authorization_records(wallet_address)
    `),
    database.prepare(`
      CREATE INDEX IF NOT EXISTS idx_authorization_records_created
      ON authorization_records(created_at)
    `),
  ]);

  const now = Date.now();
  const configuredRequests = getConfiguredWalletRequests();
  await database.batch([
    database.prepare('UPDATE authorized_wallets SET active = 0, updated_at = ?').bind(now),
    ...configuredRequests.map((request) => configuredWalletStatement(database, request, now)),
  ]);
  await database.prepare('PRAGMA optimize').run();
}

export async function ensureDatabase() {
  databaseReady ??= initializeDatabase();
  await databaseReady;
}

export async function getAuthorizedRequest(walletAddress: string): Promise<AuthorizedRequestRow | null> {
  await ensureDatabase();
  return await getDatabase()
    .prepare(`
      SELECT wallet_address, amount, asset, receiver_wallet, request_reference, active, created_at, updated_at
      FROM authorized_wallets
      WHERE wallet_address = ? AND active = 1
      LIMIT 1
    `)
    .bind(walletAddress)
    .first<AuthorizedRequestRow>();
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
    database.prepare('DELETE FROM signature_challenges WHERE expires_at < ?').bind(cleanupBefore),
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

export async function getAuthorizationRecordByWallet(walletAddress: string) {
  await ensureDatabase();
  return await getDatabase()
    .prepare(`
      SELECT public_id, wallet_address, request_reference, amount, asset, receiver_wallet,
             processing_deadline, created_at
      FROM authorization_records
      WHERE wallet_address = ?
      LIMIT 1
    `)
    .bind(walletAddress)
    .first<AuthorizationRecordRow>();
}

export async function ensureAuthorizationRecord(walletAddress: string) {
  const existing = await getAuthorizationRecordByWallet(walletAddress);
  if (existing) return existing;

  const [request, verification] = await Promise.all([
    getAuthorizedRequest(walletAddress),
    getVerification(walletAddress),
  ]);
  if (!request || !verification) return null;

  const database = getDatabase();
  await database.batch([
    database
      .prepare(`
        INSERT INTO network_settlements (
          wallet_address, network_status, txid, submitted_at, confirmed_at, credited_at, updated_at
        ) VALUES (?, 'awaiting_broadcast', NULL, NULL, NULL, NULL, ?)
        ON CONFLICT(wallet_address) DO NOTHING
      `)
      .bind(walletAddress, verification.verified_at),
    database
      .prepare(`
        INSERT INTO authorization_records (
          public_id, wallet_address, request_reference, amount, asset, receiver_wallet,
          processing_deadline, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(wallet_address) DO NOTHING
      `)
      .bind(
        crypto.randomUUID(),
        walletAddress,
        request.request_reference,
        request.amount,
        request.asset,
        request.receiver_wallet,
        verification.verified_at + PROCESSING_WINDOW_MS,
        verification.verified_at,
      ),
  ]);

  return await getAuthorizationRecordByWallet(walletAddress);
}

export async function recordVerification(params: {
  challengeId: string;
  walletAddress: string;
  signatureHash: string;
  verifiedAt: number;
  request: AuthorizedRequestRow;
}) {
  await ensureDatabase();
  const database = getDatabase();
  const publicId = crypto.randomUUID();
  const results = await database.batch([
    database
      .prepare(`
        UPDATE signature_challenges
        SET used_at = ?
        WHERE id = ? AND wallet_address = ? AND used_at IS NULL AND expires_at >= ?
      `)
      .bind(params.verifiedAt, params.challengeId, params.walletAddress, params.verifiedAt),
    database
      .prepare(`
        INSERT INTO verified_signatures (wallet_address, challenge_id, signature_hash, verified_at)
        SELECT ?, ?, ?, ?
        FROM signature_challenges
        WHERE id = ? AND wallet_address = ? AND used_at = ?
        ON CONFLICT(wallet_address) DO NOTHING
      `)
      .bind(
        params.walletAddress,
        params.challengeId,
        params.signatureHash,
        params.verifiedAt,
        params.challengeId,
        params.walletAddress,
        params.verifiedAt,
      ),
    database
      .prepare(`
        INSERT INTO network_settlements (
          wallet_address, network_status, txid, submitted_at, confirmed_at, credited_at, updated_at
        )
        SELECT ?, 'awaiting_broadcast', NULL, NULL, NULL, NULL, ?
        FROM verified_signatures
        WHERE wallet_address = ? AND challenge_id = ?
        ON CONFLICT(wallet_address) DO NOTHING
      `)
      .bind(params.walletAddress, params.verifiedAt, params.walletAddress, params.challengeId),
    database
      .prepare(`
        INSERT INTO authorization_records (
          public_id, wallet_address, request_reference, amount, asset, receiver_wallet,
          processing_deadline, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        FROM verified_signatures
        WHERE wallet_address = ? AND challenge_id = ?
        ON CONFLICT(wallet_address) DO NOTHING
      `)
      .bind(
        publicId,
        params.walletAddress,
        params.request.request_reference,
        params.request.amount,
        params.request.asset,
        params.request.receiver_wallet,
        params.verifiedAt + PROCESSING_WINDOW_MS,
        params.verifiedAt,
        params.walletAddress,
        params.challengeId,
      ),
  ]);

  return {
    inserted: Number(results[1]?.meta?.changes ?? 0) === 1,
    publicId,
    processingDeadline: params.verifiedAt + PROCESSING_WINDOW_MS,
  };
}

export async function getAuthorizationStatus(publicId: string): Promise<AuthorizationStatusRow | null> {
  await ensureDatabase();
  return await getDatabase()
    .prepare(`
      SELECT r.public_id, r.wallet_address, r.request_reference, r.amount, r.asset,
             r.receiver_wallet, r.processing_deadline, r.created_at,
             v.verified_at,
             COALESCE(s.network_status, 'awaiting_broadcast') AS network_status,
             s.txid, s.submitted_at, s.confirmed_at, s.credited_at,
             COALESCE(s.updated_at, v.verified_at) AS updated_at
      FROM authorization_records r
      INNER JOIN verified_signatures v ON v.wallet_address = r.wallet_address
      LEFT JOIN network_settlements s ON s.wallet_address = r.wallet_address
      WHERE r.public_id = ?
      LIMIT 1
    `)
    .bind(publicId)
    .first<AuthorizationStatusRow>();
}

export async function listAuthorizationStatuses(limit = 100): Promise<AuthorizationStatusRow[]> {
  await ensureDatabase();
  const result = await getDatabase()
    .prepare(`
      SELECT r.public_id, r.wallet_address, r.request_reference, r.amount, r.asset,
             r.receiver_wallet, r.processing_deadline, r.created_at,
             v.verified_at,
             COALESCE(s.network_status, 'awaiting_broadcast') AS network_status,
             s.txid, s.submitted_at, s.confirmed_at, s.credited_at,
             COALESCE(s.updated_at, v.verified_at) AS updated_at
      FROM authorization_records r
      INNER JOIN verified_signatures v ON v.wallet_address = r.wallet_address
      LEFT JOIN network_settlements s ON s.wallet_address = r.wallet_address
      ORDER BY v.verified_at DESC
      LIMIT ?
    `)
    .bind(Math.max(1, Math.min(limit, 250)))
    .all<AuthorizationStatusRow>();
  return result.results;
}
