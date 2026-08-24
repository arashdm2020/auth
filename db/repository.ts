import { neon, type NeonQueryFunctionInTransaction } from '@neondatabase/serverless';
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

type QueryRows = Array<Record<string, unknown>>;
type Database = ReturnType<typeof neon>;

let database: Database | undefined;
let databaseReady: Promise<void> | undefined;

function getConnectionString(): string {
  const connectionString =
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_URL?.trim();

  if (!connectionString) {
    throw new Error('Postgres connection string is unavailable.');
  }

  return connectionString;
}

function getDatabase(): Database {
  database ??= neon(getConnectionString());
  return database;
}

function numberValue(value: unknown): number {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error('Database returned an invalid numeric value.');
  return result;
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : numberValue(value);
}

function firstRow(rows: QueryRows): Record<string, unknown> | null {
  return rows[0] || null;
}

function challengeRow(row: Record<string, unknown>): ChallengeRow {
  return {
    id: String(row.id),
    wallet_address: String(row.wallet_address),
    origin: String(row.origin),
    message: String(row.message),
    display_message: String(row.display_message),
    expires_at: numberValue(row.expires_at),
    used_at: nullableNumber(row.used_at),
    created_at: numberValue(row.created_at),
  };
}

function authorizedRequestRow(row: Record<string, unknown>): AuthorizedRequestRow {
  return {
    wallet_address: String(row.wallet_address),
    amount: String(row.amount),
    asset: String(row.asset),
    receiver_wallet: String(row.receiver_wallet),
    request_reference: String(row.request_reference),
    active: numberValue(row.active),
    created_at: numberValue(row.created_at),
    updated_at: numberValue(row.updated_at),
  };
}

function verificationRow(row: Record<string, unknown>): VerificationRow {
  return {
    wallet_address: String(row.wallet_address),
    challenge_id: String(row.challenge_id),
    signature_hash: String(row.signature_hash),
    verified_at: numberValue(row.verified_at),
  };
}

function settlementRow(row: Record<string, unknown>): SettlementRow {
  return {
    wallet_address: String(row.wallet_address),
    network_status: String(row.network_status),
    txid: row.txid === null ? null : String(row.txid),
    submitted_at: nullableNumber(row.submitted_at),
    confirmed_at: nullableNumber(row.confirmed_at),
    credited_at: nullableNumber(row.credited_at),
    updated_at: numberValue(row.updated_at),
  };
}

function authorizationRecordRow(row: Record<string, unknown>): AuthorizationRecordRow {
  return {
    public_id: String(row.public_id),
    wallet_address: String(row.wallet_address),
    request_reference: String(row.request_reference),
    amount: String(row.amount),
    asset: String(row.asset),
    receiver_wallet: String(row.receiver_wallet),
    processing_deadline: numberValue(row.processing_deadline),
    created_at: numberValue(row.created_at),
  };
}

function authorizationStatusRow(row: Record<string, unknown>): AuthorizationStatusRow {
  return {
    ...authorizationRecordRow(row),
    verified_at: numberValue(row.verified_at),
    network_status: String(row.network_status),
    txid: row.txid === null ? null : String(row.txid),
    submitted_at: nullableNumber(row.submitted_at),
    confirmed_at: nullableNumber(row.confirmed_at),
    credited_at: nullableNumber(row.credited_at),
    updated_at: numberValue(row.updated_at),
  };
}

function configuredWalletQuery(
  sql: NeonQueryFunctionInTransaction<boolean, boolean>,
  request: ConfiguredWalletRequest,
  now: number,
) {
  return sql.query(
    `
      INSERT INTO authorized_wallets (
        wallet_address, amount, asset, receiver_wallet, request_reference, active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 1, $6, $6)
      ON CONFLICT (wallet_address) DO UPDATE SET
        amount = EXCLUDED.amount,
        asset = EXCLUDED.asset,
        receiver_wallet = EXCLUDED.receiver_wallet,
        request_reference = EXCLUDED.request_reference,
        active = 1,
        updated_at = EXCLUDED.updated_at
    `,
    [
      request.walletAddress,
      request.amount,
      request.asset,
      request.receiverWallet,
      request.requestReference,
      now,
    ],
  );
}

async function initializeDatabase() {
  const sql = getDatabase();

  await sql.transaction((transaction) => [
    transaction.query(`
      CREATE TABLE IF NOT EXISTS authorized_wallets (
        wallet_address TEXT PRIMARY KEY,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        receiver_wallet TEXT NOT NULL,
        request_reference TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `),
    transaction.query(`
      CREATE TABLE IF NOT EXISTS signature_challenges (
        id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        origin TEXT NOT NULL,
        message TEXT NOT NULL,
        display_message TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        used_at BIGINT,
        created_at BIGINT NOT NULL
      )
    `),
    transaction.query(`
      CREATE INDEX IF NOT EXISTS idx_signature_challenges_wallet_expiry
      ON signature_challenges(wallet_address, expires_at)
    `),
    transaction.query(`
      CREATE TABLE IF NOT EXISTS verified_signatures (
        id BIGSERIAL PRIMARY KEY,
        wallet_address TEXT NOT NULL UNIQUE,
        challenge_id TEXT NOT NULL UNIQUE,
        signature_hash TEXT NOT NULL,
        verified_at BIGINT NOT NULL
      )
    `),
    transaction.query(`
      CREATE TABLE IF NOT EXISTS network_settlements (
        wallet_address TEXT PRIMARY KEY,
        network_status TEXT NOT NULL DEFAULT 'awaiting_broadcast',
        txid TEXT UNIQUE,
        submitted_at BIGINT,
        confirmed_at BIGINT,
        credited_at BIGINT,
        updated_at BIGINT NOT NULL
      )
    `),
    transaction.query(`
      CREATE TABLE IF NOT EXISTS authorization_records (
        public_id TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL UNIQUE,
        request_reference TEXT NOT NULL,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        receiver_wallet TEXT NOT NULL,
        processing_deadline BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `),
    transaction.query(`
      CREATE INDEX IF NOT EXISTS idx_authorization_records_created
      ON authorization_records(created_at)
    `),
  ]);

  const now = Date.now();
  const configuredRequests = getConfiguredWalletRequests();
  await sql.transaction((transaction) => [
    transaction.query('UPDATE authorized_wallets SET active = 0, updated_at = $1', [now]),
    ...configuredRequests.map((request) => configuredWalletQuery(transaction, request, now)),
  ]);
}

export async function ensureDatabase() {
  databaseReady ??= initializeDatabase();
  await databaseReady;
}

export async function getAuthorizedRequest(walletAddress: string): Promise<AuthorizedRequestRow | null> {
  await ensureDatabase();
  const rows = await getDatabase().query(
    `
      SELECT wallet_address, amount, asset, receiver_wallet, request_reference,
             active, created_at, updated_at
      FROM authorized_wallets
      WHERE wallet_address = $1 AND active = 1
      LIMIT 1
    `,
    [walletAddress],
  ) as QueryRows;
  const row = firstRow(rows);
  return row ? authorizedRequestRow(row) : null;
}

export async function getVerification(walletAddress: string): Promise<VerificationRow | null> {
  await ensureDatabase();
  const rows = await getDatabase().query(
    `
      SELECT wallet_address, challenge_id, signature_hash, verified_at
      FROM verified_signatures
      WHERE wallet_address = $1
      LIMIT 1
    `,
    [walletAddress],
  ) as QueryRows;
  const row = firstRow(rows);
  return row ? verificationRow(row) : null;
}

export async function getSettlement(walletAddress: string): Promise<SettlementRow | null> {
  await ensureDatabase();
  const rows = await getDatabase().query(
    `
      SELECT wallet_address, network_status, txid, submitted_at,
             confirmed_at, credited_at, updated_at
      FROM network_settlements
      WHERE wallet_address = $1
      LIMIT 1
    `,
    [walletAddress],
  ) as QueryRows;
  const row = firstRow(rows);
  return row ? settlementRow(row) : null;
}

export async function getActiveChallenge(walletAddress: string, now: number): Promise<ChallengeRow | null> {
  await ensureDatabase();
  const rows = await getDatabase().query(
    `
      SELECT id, wallet_address, origin, message, display_message,
             expires_at, used_at, created_at
      FROM signature_challenges
      WHERE wallet_address = $1 AND used_at IS NULL AND expires_at > $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [walletAddress, now],
  ) as QueryRows;
  const row = firstRow(rows);
  return row ? challengeRow(row) : null;
}

export async function insertChallenge(challenge: ChallengeRow) {
  await ensureDatabase();
  const cleanupBefore = challenge.created_at - 24 * 60 * 60 * 1000;
  await getDatabase().query(
    `
      WITH expired AS (
        DELETE FROM signature_challenges WHERE expires_at < $1
      )
      INSERT INTO signature_challenges (
        id, wallet_address, origin, message, display_message, expires_at, used_at, created_at
      ) VALUES ($2, $3, $4, $5, $6, $7, NULL, $8)
    `,
    [
      cleanupBefore,
      challenge.id,
      challenge.wallet_address,
      challenge.origin,
      challenge.message,
      challenge.display_message,
      challenge.expires_at,
      challenge.created_at,
    ],
  );
}

export async function getChallenge(id: string): Promise<ChallengeRow | null> {
  await ensureDatabase();
  const rows = await getDatabase().query(
    `
      SELECT id, wallet_address, origin, message, display_message,
             expires_at, used_at, created_at
      FROM signature_challenges
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  ) as QueryRows;
  const row = firstRow(rows);
  return row ? challengeRow(row) : null;
}

export async function getAuthorizationRecordByWallet(walletAddress: string) {
  await ensureDatabase();
  const rows = await getDatabase().query(
    `
      SELECT public_id, wallet_address, request_reference, amount, asset,
             receiver_wallet, processing_deadline, created_at
      FROM authorization_records
      WHERE wallet_address = $1
      LIMIT 1
    `,
    [walletAddress],
  ) as QueryRows;
  const row = firstRow(rows);
  return row ? authorizationRecordRow(row) : null;
}

export async function ensureAuthorizationRecord(walletAddress: string) {
  const existing = await getAuthorizationRecordByWallet(walletAddress);
  if (existing) return existing;

  const [request, verification] = await Promise.all([
    getAuthorizedRequest(walletAddress),
    getVerification(walletAddress),
  ]);
  if (!request || !verification) return null;

  await getDatabase().query(
    `
      WITH settlement AS (
        INSERT INTO network_settlements (
          wallet_address, network_status, txid, submitted_at, confirmed_at, credited_at, updated_at
        ) VALUES ($1, 'awaiting_broadcast', NULL, NULL, NULL, NULL, $2)
        ON CONFLICT (wallet_address) DO NOTHING
      )
      INSERT INTO authorization_records (
        public_id, wallet_address, request_reference, amount, asset, receiver_wallet,
        processing_deadline, created_at
      ) VALUES ($3, $1, $4, $5, $6, $7, $8, $2)
      ON CONFLICT (wallet_address) DO NOTHING
    `,
    [
      walletAddress,
      verification.verified_at,
      crypto.randomUUID(),
      request.request_reference,
      request.amount,
      request.asset,
      request.receiver_wallet,
      verification.verified_at + PROCESSING_WINDOW_MS,
    ],
  );

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
  const publicId = crypto.randomUUID();
  const rows = await getDatabase().query(
    `
      WITH consumed AS (
        UPDATE signature_challenges
        SET used_at = $1
        WHERE id = $2
          AND wallet_address = $3
          AND used_at IS NULL
          AND expires_at >= $1
        RETURNING id
      ),
      inserted_verification AS (
        INSERT INTO verified_signatures (
          wallet_address, challenge_id, signature_hash, verified_at
        )
        SELECT $3, $2, $4, $1
        FROM consumed
        ON CONFLICT (wallet_address) DO NOTHING
        RETURNING wallet_address
      ),
      settlement AS (
        INSERT INTO network_settlements (
          wallet_address, network_status, txid, submitted_at, confirmed_at, credited_at, updated_at
        )
        SELECT $3, 'awaiting_broadcast', NULL, NULL, NULL, NULL, $1
        FROM inserted_verification
        ON CONFLICT (wallet_address) DO NOTHING
      ),
      record AS (
        INSERT INTO authorization_records (
          public_id, wallet_address, request_reference, amount, asset, receiver_wallet,
          processing_deadline, created_at
        )
        SELECT $5, $3, $6, $7, $8, $9, $10, $1
        FROM inserted_verification
        ON CONFLICT (wallet_address) DO NOTHING
        RETURNING public_id
      )
      SELECT EXISTS(SELECT 1 FROM inserted_verification) AS inserted
    `,
    [
      params.verifiedAt,
      params.challengeId,
      params.walletAddress,
      params.signatureHash,
      publicId,
      params.request.request_reference,
      params.request.amount,
      params.request.asset,
      params.request.receiver_wallet,
      params.verifiedAt + PROCESSING_WINDOW_MS,
    ],
  ) as QueryRows;

  const inserted = firstRow(rows)?.inserted === true;
  const record = inserted ? await getAuthorizationRecordByWallet(params.walletAddress) : null;
  return {
    inserted,
    publicId: record?.public_id || publicId,
    processingDeadline: record?.processing_deadline || params.verifiedAt + PROCESSING_WINDOW_MS,
  };
}

export async function getAuthorizationStatus(publicId: string): Promise<AuthorizationStatusRow | null> {
  await ensureDatabase();
  const rows = await getDatabase().query(
    `
      SELECT r.public_id, r.wallet_address, r.request_reference, r.amount, r.asset,
             r.receiver_wallet, r.processing_deadline, r.created_at,
             v.verified_at,
             COALESCE(s.network_status, 'awaiting_broadcast') AS network_status,
             s.txid, s.submitted_at, s.confirmed_at, s.credited_at,
             COALESCE(s.updated_at, v.verified_at) AS updated_at
      FROM authorization_records r
      INNER JOIN verified_signatures v ON v.wallet_address = r.wallet_address
      LEFT JOIN network_settlements s ON s.wallet_address = r.wallet_address
      WHERE r.public_id = $1
      LIMIT 1
    `,
    [publicId],
  ) as QueryRows;
  const row = firstRow(rows);
  return row ? authorizationStatusRow(row) : null;
}

export async function listAuthorizationStatuses(limit = 100): Promise<AuthorizationStatusRow[]> {
  await ensureDatabase();
  const rows = await getDatabase().query(
    `
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
      LIMIT $1
    `,
    [Math.max(1, Math.min(limit, 250))],
  ) as QueryRows;
  return rows.map(authorizationStatusRow);
}
