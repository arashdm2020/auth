import {
  ensureAuthorizationRecord,
  getAuthorizedRequest,
  getChallenge,
  recordVerification,
} from '@/db/repository';
import {
  hashSignature,
  isSignatureShapeValid,
  isValidTronAddress,
  recoverSigner,
} from '@/lib/verification';

export const runtime = 'nodejs';

type VerifyRequest = {
  challengeId?: unknown;
  walletAddress?: unknown;
  signature?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyRequest;
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : '';
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';
    const signature = typeof body.signature === 'string' ? body.signature.trim() : '';

    if (!challengeId || !isValidTronAddress(walletAddress) || !isSignatureShapeValid(signature)) {
      return Response.json(
        { error: 'The verification request is invalid.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const [authorizedRequest, challenge] = await Promise.all([
      getAuthorizedRequest(walletAddress),
      getChallenge(challengeId),
    ]);
    const now = Date.now();

    if (!challenge || challenge.wallet_address !== walletAddress || !authorizedRequest) {
      return Response.json(
        { error: 'This signing challenge does not belong to the connected wallet.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (challenge.used_at !== null || challenge.expires_at < now) {
      return Response.json(
        { error: 'This signing challenge has expired or has already been used.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let recoveredAddress = '';
    try {
      recoveredAddress = await recoverSigner(challenge.message, signature);
    } catch {
      return Response.json(
        { error: 'The signature is not cryptographically valid.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (recoveredAddress !== walletAddress) {
      return Response.json(
        { error: 'The signature does not match the authorized wallet.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const recorded = await recordVerification({
      challengeId,
      walletAddress,
      signatureHash: await hashSignature(signature),
      verifiedAt: now,
      request: authorizedRequest,
    });

    if (!recorded.inserted) {
      const existing = await ensureAuthorizationRecord(walletAddress);
      if (existing) {
        return Response.json(
          {
            verified: true,
            alreadyVerified: true,
            statusUrl: `/status/${existing.public_id}`,
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return Response.json(
        { error: 'This wallet has already used its one-time signature authorization.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return Response.json(
      {
        verified: true,
        walletAddress,
        verifiedAt: now,
        networkStatus: 'awaiting_broadcast',
        txid: null,
        processingDeadline: recorded.processingDeadline,
        statusUrl: `/status/${recorded.publicId}`,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Verification error', error);
    return Response.json(
      { error: 'Unable to complete cryptographic signature verification.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
