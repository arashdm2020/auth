import assert from 'node:assert/strict';
import test from 'node:test';
import { getRemainingLockHours, multisigBlockMessage } from '../lib/access-lock.ts';

test('shows the exact configured multisig restriction after connection', () => {
  const now = 1_700_000_000_000;
  const blockedUntil = now + 12 * 60 * 60 * 1000;

  assert.equal(getRemainingLockHours(blockedUntil, now), 12);
  assert.equal(
    multisigBlockMessage(12),
    'به دلیل فعالیت مشکوک و انتظار بیش از حد دسترسی شما به multisig تا 12 ساعت دیگر بسته شد',
  );
});
