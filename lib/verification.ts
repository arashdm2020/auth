import { TronWeb, Trx } from 'tronweb';

export const DEFAULT_AUTHORIZED_WALLET = 'TEq6bXGJ5rkpUjgb3ygVyMJ6FXxWqLA3Cy';
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function isValidTronAddress(address: string): boolean {
  return TronWeb.isAddress(address);
}

function toHex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function buildChallenge(params: {
  walletAddress: string;
  origin: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}) {
  const displayMessage = [
    'TRON Proof - Wallet Ownership Verification',
    '',
    `Wallet: ${params.walletAddress}`,
    `Origin: ${params.origin}`,
    `Challenge: ${params.nonce}`,
    `Issued at: ${new Date(params.issuedAt).toISOString()}`,
    `Expires at: ${new Date(params.expiresAt).toISOString()}`,
    '',
    'This signature proves wallet ownership only.',
    'It does not authorize a transaction or asset transfer.',
  ].join('\n');

  return {
    displayMessage,
    signableMessage: toHex(displayMessage),
  };
}

export async function recoverSigner(message: string, signature: string): Promise<string> {
  return await Trx.verifyMessageV2(message, signature);
}

export function isSignatureShapeValid(signature: string): boolean {
  return /^0x[0-9a-fA-F]{130}$/.test(signature);
}

export async function hashSignature(signature: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
