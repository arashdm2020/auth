export const runtime = 'nodejs';

export async function GET() {
  return Response.json(
    {
      network: 'TRON Mainnet',
      assetStandard: 'TRC20',
      signingPolicy: 'one_verified_signature_per_wallet',
      requestDetailsLocked: true,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
