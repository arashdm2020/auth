import {
  getActiveChallenge,
  ensureAuthorizationRecord,
  getAuthorizedRequest,
  getVerification,
  insertChallenge,
} from '@/db/repository';
import { buildChallenge, CHALLENGE_TTL_MS, isValidTronAddress, newNonce } from '@/lib/verification';
import { getRemainingLockHours, multisigBlockMessage } from '@/lib/access-lock';

export const runtime = 'nodejs';

type ChallengeRequest = { walletAddress?: unknown };

function requestDetails(request: NonNullable<Awaited<ReturnType<typeof getAuthorizedRequest>>>) {
  return {
    amount: request.amount,
    asset: request.asset,
    senderWallet: request.receiver_wallet,
    receiverWallet: request.wallet_address,
    reference: request.request_reference,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChallengeRequest;
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';
    const authorizedRequest = isValidTronAddress(walletAddress)
      ? await getAuthorizedRequest(walletAddress)
      : null;

    if (!isValidTronAddress(walletAddress) || !authorizedRequest) {
      return Response.json(
        { error: 'Wallet authorization failed. Review the connected account and try again.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const now = Date.now();
    if (authorizedRequest.blocked_until && authorizedRequest.blocked_until > now) {
      const remainingHours = getRemainingLockHours(authorizedRequest.blocked_until, now);
      return Response.json(
        { error: multisigBlockMessage(remainingHours), blockedUntil: authorizedRequest.blocked_until },
        { status: 423, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const existingVerification = await getVerification(walletAddress);
    if (existingVerification) {
      const record = await ensureAuthorizationRecord(walletAddress);
      if (!record) throw new Error('Verified wallet record is unavailable.');
      return Response.json(
        {
          alreadyVerified: true,
          verifiedAt: existingVerification.verified_at,
          statusUrl: `/status/${record.public_id}`,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const activeChallenge = await getActiveChallenge(walletAddress, now);
    if (activeChallenge) {
      return Response.json(
        {
          id: activeChallenge.id,
          message: activeChallenge.message,
          displayMessage: activeChallenge.display_message,
          expiresAt: activeChallenge.expires_at,
          request: requestDetails(authorizedRequest),
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
      {
        id,
        message: signableMessage,
        displayMessage,
        expiresAt,
        request: requestDetails(authorizedRequest),
      },
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
