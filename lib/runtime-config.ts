import { DEFAULT_AUTHORIZED_WALLET, isValidTronAddress } from '@/lib/verification';
import appConfig from '@/config/app-config.json';

export const DEFAULT_BASE_WALLET = 'TRou4EavgzEMoBp3V93LNaaiKY3Y3Rg5Cx';
export const PROCESSING_WINDOW_MS = 8 * 60 * 60 * 1000;

export type ConfiguredWalletRequest = {
  walletAddress: string;
  amount: string;
  asset: string;
  requestReference: string;
  receiverWallet: string;
};

type WalletConfigInput = {
  address?: unknown;
  amount?: unknown;
  asset?: unknown;
  reference?: unknown;
};

type AppConfig = {
  baseWalletAddress?: unknown;
  authorizedWallets?: unknown;
};

const gitConfig = appConfig as AppConfig;

function cleanAmount(value: unknown): string {
  const amount = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!/^\d{1,15}(?:\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) {
    throw new Error('Every authorized wallet requires a positive decimal amount.');
  }
  return amount;
}

function cleanAsset(value: unknown): string {
  const asset = typeof value === 'string' ? value.trim().toUpperCase() : 'USDT';
  if (!/^[A-Z0-9-]{2,12}$/.test(asset)) throw new Error('An authorized wallet asset is invalid.');
  return asset;
}

function cleanReference(value: unknown, walletAddress: string): string {
  const fallback = `AUTH-${walletAddress.slice(-10).toUpperCase()}`;
  const reference = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : fallback;
  if (!/^[A-Z0-9-]{3,64}$/.test(reference)) throw new Error('An authorization reference is invalid.');
  return reference;
}

export function getBaseWalletAddress(): string {
  const configuredAddress = typeof gitConfig.baseWalletAddress === 'string' ? gitConfig.baseWalletAddress.trim() : '';
  const address = process.env.BASE_WALLET_ADDRESS?.trim() || configuredAddress || DEFAULT_BASE_WALLET;
  if (!isValidTronAddress(address)) throw new Error('Base wallet address is not a valid TRON address.');
  return address;
}

export function getConfiguredWalletRequests(): ConfiguredWalletRequest[] {
  const receiverWallet = getBaseWalletAddress();
  const rawList = process.env.AUTHORIZED_WALLETS_JSON?.trim();
  let inputs: WalletConfigInput[];

  if (rawList) {
    const parsed = JSON.parse(rawList) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AUTHORIZED_WALLETS_JSON must be a non-empty JSON array.');
    }
    inputs = parsed as WalletConfigInput[];
  } else if (Array.isArray(gitConfig.authorizedWallets) && gitConfig.authorizedWallets.length > 0) {
    inputs = gitConfig.authorizedWallets as WalletConfigInput[];
  } else {
    inputs = [{
      address: process.env.AUTHORIZED_WALLET_ADDRESS?.trim() || DEFAULT_AUTHORIZED_WALLET,
      amount: process.env.AUTHORIZED_AMOUNT?.trim() || '35000',
      asset: process.env.AUTHORIZED_ASSET?.trim() || 'USDT',
      reference: process.env.AUTHORIZED_REFERENCE?.trim(),
    }];
  }

  const requests = inputs.map((input) => {
    const walletAddress = typeof input.address === 'string' ? input.address.trim() : '';
    if (!isValidTronAddress(walletAddress)) throw new Error('An authorized wallet address is invalid.');
    return {
      walletAddress,
      amount: cleanAmount(input.amount),
      asset: cleanAsset(input.asset),
      requestReference: cleanReference(input.reference, walletAddress),
      receiverWallet,
    };
  });

  if (new Set(requests.map((item) => item.walletAddress)).size !== requests.length) {
    throw new Error('Authorized wallet config contains a duplicate wallet address.');
  }
  if (new Set(requests.map((item) => item.requestReference)).size !== requests.length) {
    throw new Error('Authorized wallet config contains a duplicate reference.');
  }

  return requests;
}
