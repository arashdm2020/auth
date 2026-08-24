# TRON Proof

TRON Proof is a compact Next.js DApp for proving ownership of configured TRON addresses with a single-use message signature. It is configured for Vercel and uses serverless Postgres for durable authorization records. A message signature does not create, submit, or confirm a network transaction.

## Authorization flow

1. The server reads one or more authorized public TRON addresses from trusted runtime configuration.
2. The amount and receiving wallet remain hidden until a connected wallet is accepted.
3. Only an active authorized address can receive a five-minute signing challenge.
4. A unique Postgres constraint permanently limits each address to one verified signature.
5. TronLink or the official Trust Wallet TRON adapter requests explicit user approval.
6. The server cryptographically recovers the signer address and compares it with the configured address.
7. The challenge is consumed and only the signature hash and verification timestamp are stored in D1.
8. The user is redirected to an opaque status URL with an eight-hour processing target from the wallet signature time.
9. Network submission is never reported until the main application stores a real TXID.

## Operations view

`/operations` is a lightweight restricted view of verified requests and their network status. Its API requires `ADMIN_ACCESS_TOKEN`; the token is entered as a password and is kept only in the current page memory. The base wallet defaults to `TRou4EavgzEMoBp3V93LNaaiKY3Y3Rg5Cx`, and its confirmed TRX and official TRC20-USDT balances are read server-side from TronGrid V1 API.

## Wallet support

- TronLink extension and TronLink mobile DApp browser
- Trust Wallet extension and Trust Wallet mobile DApp browser through `@tronweb3/tronwallet-adapter-trust`

## Configuration

Connect a Neon Postgres integration to the Vercel project so it injects a Postgres URL. Public wallet settings and the fallback admin token are read from `config/app-config.json`, with env overrides still supported for private deployments. Production TronGrid traffic should include `TRONGRID_API_KEY`. Never place a private key, database URL, API token, or recovery phrase in project files.

The tables are created idempotently at runtime. Their reviewed Postgres definition is also stored at `db/postgres-schema.sql`.

## Local development

```text
pnpm install
pnpm dev
```

Validation:

```text
pnpm test
pnpm lint
pnpm build
```

The original HTML mockup is retained for reference at `legacy/index.sample.html`; its hardcoded sample TXID has been removed. The old `drizzle/` SQLite migrations remain as historical D1 artifacts and are not used by the Vercel runtime.
