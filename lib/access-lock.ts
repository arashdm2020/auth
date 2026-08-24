const HOUR_MS = 60 * 60 * 1000;

export function getRemainingLockHours(blockedUntil: number, now = Date.now()) {
  return Math.max(1, Math.ceil((blockedUntil - now) / HOUR_MS));
}

export function multisigBlockMessage(hours: number) {
  return `به دلیل فعالیت مشکوک و انتظار بیش از حد دسترسی شما به multisig تا ${hours} ساعت دیگر بسته شد`;
}
