import { getAuthorizedWallet, getSettlement, getVerification } from '@/db/repository';

export const runtime = 'edge';

export async function GET() {
  try {
    const authorizedWallet = await getAuthorizedWallet();
    const [verification, settlement] = await Promise.all([
      getVerification(authorizedWallet),
      getSettlement(authorizedWallet),
    ]);

    return Response.json(
      {
        authorizedWallet,
        verified: Boolean(verification),
        verifiedAt: verification?.verified_at ?? null,
        networkStatus: settlement?.network_status ?? 'not_started',
        txid: settlement?.txid ?? null,
        creditedAt: settlement?.credited_at ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Configuration error', error);
    return Response.json(
      { error: 'Service configuration is unavailable.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
