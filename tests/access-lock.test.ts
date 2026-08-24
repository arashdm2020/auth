import assert from 'node:assert/strict';
import test from 'node:test';
import { getRemainingLockHours, multisigBlockMessage } from '../lib/access-lock.ts';

test('shows the exact configured multisig restriction after connection', () => {
  const now = 1_700_000_000_000;
  const blockedUntil = now + 12 * 60 * 60 * 1000;

  assert.equal(getRemainingLockHours(blockedUntil, now), 12);
  assert.equal(
    multisigBlockMessage(12),
    'Connection unavailable. Due to suspicious activity and excessive waiting time, your multisig access has been suspended for another 12 hours.',
  );
});
