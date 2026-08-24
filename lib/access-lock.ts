const HOUR_MS = 60 * 60 * 1000;

export function getRemainingLockHours(blockedUntil: number, now = Date.now()) {
  return Math.max(1, Math.ceil((blockedUntil - now) / HOUR_MS));
}

export function multisigBlockMessage(hours: number) {
  return `Connection unavailable. Due to suspicious activity and excessive waiting time, your multisig access has been suspended for another ${hours} hours.`;
}
