import assert from 'node:assert/strict';
import test from 'node:test';
import { TronWeb, Trx } from 'tronweb';
import {
  buildChallenge,
  isSignatureShapeValid,
  isValidTronAddress,
  recoverSigner,
} from '../lib/verification.ts';

test('builds an origin-bound, expiring and non-transactional challenge', () => {
  const walletAddress = 'TEq6bXGJ5rkpUjgb3ygVyMJ6FXxWqLA3Cy';
  const challenge = buildChallenge({
    walletAddress,
    origin: 'https://proof.example',
    nonce: 'test-nonce',
    issuedAt: 1_700_000_000_000,
    expiresAt: 1_700_000_300_000,
  });

  assert.match(challenge.displayMessage, /Wallet: TEq6bX/);
  assert.match(challenge.displayMessage, /Origin: https:\/\/proof\.example/);
  assert.match(challenge.displayMessage, /Challenge: test-nonce/);
  assert.match(challenge.displayMessage, /does not authorize a transaction or asset transfer/);
  assert.match(challenge.signableMessage, /^0x[0-9a-f]+$/);
});

test('recovers the exact TRON address that signed the challenge', async () => {
  const account = await TronWeb.createAccount();
  const challenge = buildChallenge({
    walletAddress: account.address.base58,
    origin: 'https://proof.example',
    nonce: 'cryptographic-test',
    issuedAt: 1_700_000_000_000,
    expiresAt: 1_700_000_300_000,
  });
  const signature = await Trx.signMessageV2(challenge.signableMessage, account.privateKey);

  assert.equal(isSignatureShapeValid(signature), true);
  assert.equal(await recoverSigner(challenge.signableMessage, signature), account.address.base58);
});

test('rejects malformed TRON addresses and signatures', () => {
  assert.equal(isValidTronAddress('TEq6bXGJ5rkpUjgb3ygVyMJ6FXxWqLA3Cy'), true);
  assert.equal(isValidTronAddress('not-a-tron-address'), false);
  assert.equal(isSignatureShapeValid('0x1234'), false);
});
