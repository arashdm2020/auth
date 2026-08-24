import { getBaseWalletAddress } from '@/lib/runtime-config';

const SIX_DECIMAL_UNITS = 1_000_000n;
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

function formatSixDecimals(value: bigint): string {
  const whole = value / SIX_DECIMAL_UNITS;
  const fractional = (value % SIX_DECIMAL_UNITS).toString().padStart(6, '0').replace(/0+$/, '');
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export type TronBalance = {
  address: string;
  balanceSun: string;
  balanceTrx: string;
  usdtAtomic: string;
  balanceUsdt: string;
  usdtContract: string;
  fetchedAt: number;
  source: string;
};

export async function getBaseWalletBalance(): Promise<TronBalance> {
  const address = getBaseWalletAddress();
  const baseUrl = (process.env.TRONGRID_BASE_URL?.trim() || 'https://api.trongrid.io').replace(/\/+$/, '');
  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('TRONGRID_BASE_URL must use HTTPS.');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const apiKey = process.env.TRONGRID_API_KEY?.trim();
  if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

  const response = await fetch(`${baseUrl}/v1/accounts/${address}?only_confirmed=true`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(8_000),
  });
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`TRON API returned HTTP ${response.status}.`);
  }

  const parsed = JSON.parse(raw) as {
    data?: Array<{ balance?: number | string; trc20?: Array<Record<string, string>> }>;
  };
  const account = parsed.data?.[0];
  if (!account) throw new Error('The base wallet was not returned by TronGrid.');

  const balanceSun = String(account.balance ?? '0');
  if (!/^\d+$/.test(balanceSun)) throw new Error('TRX balance returned by TronGrid is invalid.');
  const usdtAtomic = account.trc20?.find((token) => USDT_CONTRACT in token)?.[USDT_CONTRACT] || '0';
  if (!/^\d+$/.test(usdtAtomic)) throw new Error('USDT balance returned by TronGrid is invalid.');

  return {
    address,
    balanceSun,
    balanceTrx: formatSixDecimals(BigInt(balanceSun)),
    usdtAtomic,
    balanceUsdt: formatSixDecimals(BigInt(usdtAtomic)),
    usdtContract: USDT_CONTRACT,
    fetchedAt: Date.now(),
    source: 'TronGrid V1 account API',
  };
}
