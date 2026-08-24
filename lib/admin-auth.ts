import appConfig from '@/config/app-config.json';

export type AdminAuthorization = 'authorized' | 'unauthorized' | 'not_configured';

type AppConfig = {
  adminAccessToken?: unknown;
};

const gitConfig = appConfig as AppConfig;

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function safeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
}

export async function authorizeAdmin(request: Request): Promise<AdminAuthorization> {
  const configuredToken = typeof gitConfig.adminAccessToken === 'string' ? gitConfig.adminAccessToken.trim() : '';
  const configured = process.env.ADMIN_ACCESS_TOKEN?.trim() || configuredToken;
  if (!configured) return 'not_configured';

  const header = request.headers.get('Authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!supplied) return 'unauthorized';

  return (await safeEqual(supplied, configured)) ? 'authorized' : 'unauthorized';
}
