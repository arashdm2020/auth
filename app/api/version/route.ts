import appConfig from '@/config/app-config.json';

export const runtime = 'nodejs';

type AppConfig = {
  adminAccessToken?: unknown;
  baseWalletAddress?: unknown;
  authorizedWallets?: unknown;
};

const gitConfig = appConfig as AppConfig;

export function GET() {
  return Response.json(
    {
      version: '2026-08-24-admin-wallet-authorizations-v3',
      adminFallbackConfigured: typeof gitConfig.adminAccessToken === 'string' && gitConfig.adminAccessToken.length > 0,
      baseWalletConfigured: typeof gitConfig.baseWalletAddress === 'string' && gitConfig.baseWalletAddress.length > 0,
      authorizedWalletCount: Array.isArray(gitConfig.authorizedWallets) ? gitConfig.authorizedWallets.length : 0,
      supportedDatabaseEnv: [
        'DATABASE_URL',
        'DATABASE_URL_UNPOOLED',
        'POSTGRES_PRISMA_URL',
        'POSTGRES_URL_NON_POOLING',
        'POSTGRES_URL',
      ],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
