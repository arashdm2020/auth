import { authorizeAdmin } from '@/lib/admin-auth';
import { listAuthorizationStatuses, listAuthorizedWallets } from '@/db/repository';
import { getBaseWalletBalance } from '@/lib/tron-api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request);
  if (authorization === 'not_configured') {
    return Response.json(
      { error: 'Admin access was denied.' },
      { status: 401, headers: { 'Cache-Control': 'no-store', 'X-App-Version': '2026-08-24-admin-db-config-v2' } },
    );
  }
  if (authorization !== 'authorized') {
    return Response.json(
      { error: 'Admin access was denied.' },
      { status: 401, headers: { 'Cache-Control': 'no-store', 'X-App-Version': '2026-08-24-admin-db-config-v2' } },
    );
  }

  try {
    const [records, authorizedWallets, balanceResult] = await Promise.all([
      listAuthorizationStatuses(),
      listAuthorizedWallets(),
      getBaseWalletBalance()
        .then((balance) => ({ balance, balanceError: null }))
        .catch((error: Error) => ({ balance: null, balanceError: error.message })),
    ]);

    return Response.json(
      {
        baseWallet: balanceResult.balance,
        balanceError: balanceResult.balanceError,
        authorizedWallets: authorizedWallets.map((wallet) => ({
          wallet: wallet.wallet_address,
          amount: wallet.amount,
          asset: wallet.asset,
          senderWallet: wallet.receiver_wallet,
          receiverWallet: wallet.wallet_address,
          requestReference: wallet.request_reference,
          blockedUntil: wallet.blocked_until,
          active: wallet.active === 1,
          createdAt: wallet.created_at,
          updatedAt: wallet.updated_at,
          signedAt: wallet.signed_at,
        })),
        records: records.map((record) => ({
          referenceId: record.public_id,
          requestReference: record.request_reference,
          wallet: record.wallet_address,
          amount: record.amount,
          asset: record.asset,
          senderWallet: record.receiver_wallet,
          receiverWallet: record.wallet_address,
          verifiedAt: record.verified_at,
          processingDeadline: record.processing_deadline,
          networkStatus: record.network_status,
          txid: record.txid,
          submittedAt: record.submitted_at,
          confirmedAt: record.confirmed_at,
          creditedAt: record.credited_at,
          updatedAt: record.updated_at,
        })),
      },
      { headers: { 'Cache-Control': 'no-store', 'X-App-Version': '2026-08-24-admin-db-config-v2' } },
    );
  } catch (error) {
    console.error('Operations error', error);
    return Response.json(
      { error: 'Operations data is temporarily unavailable.' },
      { status: 500, headers: { 'Cache-Control': 'no-store', 'X-App-Version': '2026-08-24-admin-db-config-v2' } },
    );
  }
}
