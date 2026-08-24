# TRON Proof

TRON Proof is a compact DApp interface for proving ownership of one configured TRON address with a one-time message signature. A message signature does not create, submit, or confirm a network transaction.

## Authorization flow

1. The server reads the authorized public TRON address from trusted runtime configuration.
2. Only that address can receive a five-minute signing challenge.
3. TronLink or the official Trust Wallet TRON adapter requests explicit user approval.
4. The server cryptographically recovers the signer address and compares it with the configured address.
5. The challenge is consumed and only the signature hash and verification timestamp are stored in D1.
6. The network settlement remains `validation_pending` until the main application submits a real transaction and records its TXID.

## Wallet support

- TronLink extension and TronLink mobile DApp browser
- Trust Wallet extension and Trust Wallet mobile DApp browser through `@tronweb3/tronwallet-adapter-trust`

## Configuration

Copy `.env.example` and set `AUTHORIZED_WALLET_ADDRESS` to the permitted public TRON address. Never place a private key or recovery phrase in project files, hosting configuration, or the database.

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

The original HTML mockup is retained for reference at `legacy/index.sample.html`; its hardcoded sample TXID has been removed.
