import {
  getActiveChallenge,
  getAuthorizedWallet,
  getVerification,
  insertChallenge,
} from '@/db/repository';
import { buildChallenge, CHALLENGE_TTL_MS, isValidTronAddress, newNonce } from '@/lib/verification';

export const runtime = 'edge';

type ChallengeRequest = { walletAddress?: unknown };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChallengeRequest;
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';
    const authorizedWallet = await getAuthorizedWallet();

    if (!isValidTronAddress(walletAddress) || walletAddress !== authorizedWallet) {
      return Response.json(
        { error: 'Wallet authorization failed. Review the connected account and try again.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const existingVerification = await getVerification(walletAddress);
    if (existingVerification) {
      return Response.json(
        { alreadyVerified: true, verifiedAt: existingVerification.verified_at },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const now = Date.now();
    const activeChallenge = await getActiveChallenge(walletAddress, now);
    if (activeChallenge) {
      return Response.json(
        {
          id: activeChallenge.id,
          message: activeChallenge.message,
          displayMessage: activeChallenge.display_message,
          expiresAt: activeChallenge.expires_at,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const origin = new URL(request.url).origin;
    const expiresAt = now + CHALLENGE_TTL_MS;
    const { displayMessage, signableMessage } = buildChallenge({
      walletAddress,
      origin,
      nonce: newNonce(),
      issuedAt: now,
      expiresAt,
    });
    const id = crypto.randomUUID();

    await insertChallenge({
      id,
      wallet_address: walletAddress,
      origin,
      message: signableMessage,
      display_message: displayMessage,
      expires_at: expiresAt,
      used_at: null,
      created_at: now,
    });

    return Response.json(
      { id, message: signableMessage, displayMessage, expiresAt },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Challenge error', error);
    return Response.json(
      { error: 'Unable to create a signing request.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
