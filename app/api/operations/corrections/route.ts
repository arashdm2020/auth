import { correctAuthorizationAmount } from '@/db/repository';
import { authorizeAdmin } from '@/lib/admin-auth';
import { isValidTronAddress } from '@/lib/verification';

export const runtime = 'nodejs';

type CorrectionInput = {
  publicId?: unknown;
  walletAddress?: unknown;
  requestReference?: unknown;
  currentAmount?: unknown;
  correctedAmount?: unknown;
  reason?: unknown;
};

function requiredString(value: unknown, label: string) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function cleanAmount(value: unknown, label: string) {
  const amount = requiredString(value, label);
  if (!/^\d{1,15}(?:\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) {
    throw new Error(`${label} must be a positive amount.`);
  }
  return amount;
}

export async function POST(request: Request) {
  if (await authorizeAdmin(request) !== 'authorized') {
    return Response.json(
      { error: 'Admin access was denied.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const body = (await request.json()) as CorrectionInput;
    const publicId = requiredString(body.publicId, 'Public ID');
    const walletAddress = requiredString(body.walletAddress, 'Wallet address');
    const requestReference = requiredString(body.requestReference, 'Request reference').toUpperCase();
    const currentAmount = cleanAmount(body.currentAmount, 'Current amount');
    const correctedAmount = cleanAmount(body.correctedAmount, 'Corrected amount');
    const reason = requiredString(body.reason, 'Correction reason');

    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(publicId)) throw new Error('Public ID is invalid.');
    if (!isValidTronAddress(walletAddress)) throw new Error('Wallet address is invalid.');
    if (!/^[A-Z0-9-]{3,64}$/.test(requestReference)) throw new Error('Request reference is invalid.');
    if (currentAmount === correctedAmount) throw new Error('Corrected amount must be different.');
    if (reason.length > 240) throw new Error('Correction reason is too long.');

    const record = await correctAuthorizationAmount({
      publicId,
      walletAddress,
      requestReference,
      currentAmount,
      correctedAmount,
      reason,
    });

    return Response.json(
      {
        corrected: true,
        record: {
          referenceId: record.public_id,
          requestReference: record.request_reference,
          wallet: record.wallet_address,
          amount: record.amount,
          asset: record.asset,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The authorization amount could not be corrected.';
    return Response.json(
      { error: message },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
