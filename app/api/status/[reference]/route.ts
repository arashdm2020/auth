import { getAuthorizationStatus } from '@/db/repository';

export const runtime = 'edge';

function maskAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-6)}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(reference)) {
      return Response.json(
        { error: 'Authorization status was not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const status = await getAuthorizationStatus(reference);
    if (!status) {
      return Response.json(
        { error: 'Authorization status was not found.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return Response.json(
      {
        referenceId: status.public_id,
        requestReference: status.request_reference,
        wallet: maskAddress(status.wallet_address),
        amount: status.amount,
        asset: status.asset,
        receiverWallet: maskAddress(status.receiver_wallet),
        verifiedAt: status.verified_at,
        processingDeadline: status.processing_deadline,
        networkStatus: status.network_status,
        txid: status.txid,
        submittedAt: status.submitted_at,
        confirmedAt: status.confirmed_at,
        creditedAt: status.credited_at,
        updatedAt: status.updated_at,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Status error', error);
    return Response.json(
      { error: 'Authorization status is temporarily unavailable.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

