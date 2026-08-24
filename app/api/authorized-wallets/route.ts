import {
  deleteAuthorizedWallet,
  listAuthorizedWallets,
  updateAuthorizedWallet,
  upsertAuthorizedWallet,
} from '@/db/repository';
import { authorizeAdmin } from '@/lib/admin-auth';
import { getBaseWalletAddress } from '@/lib/runtime-config';
import { isValidTronAddress } from '@/lib/verification';

export const runtime = 'nodejs';

type WalletInput = {
  originalWalletAddress?: unknown;
  walletAddress?: unknown;
  amount?: unknown;
  asset?: unknown;
  reference?: unknown;
};

function unauthorizedResponse() {
  return Response.json(
    { error: 'Admin access was denied.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

function cleanWalletAddress(value: unknown) {
  const walletAddress = typeof value === 'string' ? value.trim() : '';
  if (!isValidTronAddress(walletAddress)) throw new Error('Enter a valid TRON wallet address.');
  return walletAddress;
}

function walletRequest(body: WalletInput) {
  const walletAddress = cleanWalletAddress(body.walletAddress);
  return {
    walletAddress,
    amount: cleanAmount(body.amount),
    asset: cleanAsset(body.asset),
    requestReference: cleanReference(body.reference, walletAddress),
    receiverWallet: getBaseWalletAddress(),
  };
}

function cleanAmount(value: unknown) {
  const amount = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!/^\d{1,15}(?:\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) {
    throw new Error('Enter a positive amount.');
  }
  return amount;
}

function cleanAsset(value: unknown) {
  const asset = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'USDT';
  if (!/^[A-Z0-9-]{2,12}$/.test(asset)) throw new Error('Asset is invalid.');
  return asset;
}

function cleanReference(value: unknown, walletAddress: string) {
  const fallback = `AUTH-${walletAddress.slice(-10).toUpperCase()}`;
  const reference = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : fallback;
  if (!/^[A-Z0-9-]{3,64}$/.test(reference)) throw new Error('Reference is invalid.');
  return reference;
}

export async function GET(request: Request) {
  if (await authorizeAdmin(request) !== 'authorized') return unauthorizedResponse();

  try {
    const wallets = await listAuthorizedWallets();
    return Response.json({ wallets }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Authorized wallets list error', error);
    return Response.json(
      { error: 'Authorized wallets could not be loaded.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: Request) {
  if (await authorizeAdmin(request) !== 'authorized') return unauthorizedResponse();

  try {
    const body = (await request.json()) as WalletInput;
    const wallet = await upsertAuthorizedWallet(walletRequest(body));

    return Response.json({ wallet }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authorized wallet could not be saved.';
    return Response.json(
      { error: message },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}


export async function PATCH(request: Request) {
  if (await authorizeAdmin(request) !== 'authorized') return unauthorizedResponse();

  try {
    const body = (await request.json()) as WalletInput;
    const originalWalletAddress = cleanWalletAddress(body.originalWalletAddress);
    const wallet = await updateAuthorizedWallet(originalWalletAddress, walletRequest(body));
    return Response.json({ wallet }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authorized wallet could not be updated.';
    return Response.json(
      { error: message },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function DELETE(request: Request) {
  if (await authorizeAdmin(request) !== 'authorized') return unauthorizedResponse();

  try {
    const body = (await request.json()) as WalletInput;
    const walletAddress = cleanWalletAddress(body.walletAddress);
    await deleteAuthorizedWallet(walletAddress);
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authorized wallet could not be deleted.';
    return Response.json(
      { error: message },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
