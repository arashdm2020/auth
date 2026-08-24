'use client';

import Image from 'next/image';
import { TrustAdapter } from '@tronweb3/tronwallet-adapter-trust';
import { useEffect, useMemo, useState } from 'react';

type TronWebLike = {
  defaultAddress?: { base58?: string };
  trx: { signMessageV2: (message: string) => Promise<string> };
};

type TronProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  tronWeb?: TronWebLike | false;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type TronWindow = Window & {
  tron?: TronProvider;
  tronLink?: TronProvider;
  tronWeb?: TronWebLike;
  trustwallet?: {
    tronLink?: TronProvider;
  };
};
type WalletKind = 'tronlink' | 'trust';
type Phase = 'loading' | 'idle' | 'connecting' | 'ready' | 'signing' | 'verifying' | 'redirecting' | 'error';

type RequestDetails = {
  amount: string;
  asset: string;
  senderWallet: string;
  receiverWallet: string;
  reference: string;
};

type Challenge = {
  id: string;
  message: string;
  displayMessage: string;
  expiresAt: number;
  request: RequestDetails;
};

type ChallengeResponse = Partial<Challenge> & {
  alreadyVerified?: boolean;
  verifiedAt?: number;
  statusUrl?: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function getTronLink() {
  const walletWindow = window as TronWindow;
  const modernProvider = walletWindow.tron;
  const legacyProvider = walletWindow.tronLink;
  const provider = modernProvider || legacyProvider;
  const tronWeb = provider?.tronWeb || walletWindow.tronWeb;
  return { provider, tronWeb, isLegacy: !modernProvider && Boolean(legacyProvider) };
}

function getTrustWallet() {
  const walletWindow = window as TronWindow;
  const provider = walletWindow.trustwallet?.tronLink;
  const tronWeb = provider?.tronWeb || walletWindow.tronWeb;
  return { provider, tronWeb };
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
}

function isTrustBrowser() {
  return /Trust/i.test(window.navigator.userAgent) || Boolean((window as TronWindow).trustwallet?.tronLink);
}

function getTrustDappUrl() {
  return `https://link.trustwallet.com/open_url?url=${encodeURIComponent(window.location.href)}`;
}

function getTronLinkDappUrl() {
  const payload = {
    action: 'open',
    actionId: Date.now().toString(),
    callbackUrl: window.location.href,
    dappIcon: `${window.location.origin}/tron-logo.png`,
    dappName: 'TRON PROOF',
    url: window.location.href,
    protocol: 'TronLink',
    version: '1.0',
    chainId: '0x2b6653dc',
  };
  return `tronlinkoutside://pull.activity?param=${encodeURIComponent(JSON.stringify(payload))}`;
}

function detectInjectedWalletKind(): WalletKind | null {
  if (getTrustWallet().provider || isTrustBrowser()) return 'trust';
  if (getTronLink().provider) return 'tronlink';
  return null;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForTrustAddress(adapter: TrustAdapter) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { tronWeb } = getTrustWallet();
    const address = tronWeb?.defaultAddress?.base58 || adapter.address || '';
    if (address) return address;
    await wait(200);
  }
  return '';
}

function shortenAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-6)}`;
}

function displayAmount(amount: string) {
  const value = Number(amount);
  return Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)
    : amount;
}

export default function WalletVerification() {
  const trustAdapter = useMemo(
    () => new TrustAdapter({ checkTimeout: 2500, openAppWithDeeplink: false, openUrlWhenWalletNotFound: false }),
    [],
  );
  const [connectedWallet, setConnectedWallet] = useState('');
  const [walletKind, setWalletKind] = useState<WalletKind | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('Loading secure authorization policy...');
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/config', { cache: 'no-store' })
      .then((response) => readResponse(response))
      .then(() => {
        if (!active) return;
        setPhase('idle');
        setMessage('Choose a compatible wallet to check eligibility.');
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
      setRequestDetails(null);
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

  const busy = ['loading', 'connecting', 'signing', 'verifying', 'redirecting'].includes(phase);

  useEffect(() => {
    if (phase !== 'idle' || autoConnectAttempted) return;
    const detectedKind = detectInjectedWalletKind();
    if (!detectedKind) return;
    setAutoConnectAttempted(true);
    void connectWallet(detectedKind);
  }, [autoConnectAttempted, phase]);

  async function requestChallenge(address: string) {
    const response = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address }),
    });
    const data = await readResponse<ChallengeResponse>(response);

    if (data.alreadyVerified && data.statusUrl) {
      setPhase('redirecting');
      setMessage('This wallet has already completed its one-time signature. Opening its status page...');
      window.location.assign(data.statusUrl);
      return;
    }

    if (!data.id || !data.message || !data.displayMessage || !data.expiresAt || !data.request) {
      throw new Error('The authorization request is incomplete.');
    }

    const nextChallenge: Challenge = {
      id: data.id,
      message: data.message,
      displayMessage: data.displayMessage,
      expiresAt: data.expiresAt,
      request: data.request,
    };
    setChallenge(nextChallenge);
    setRequestDetails(data.request);
    setPhase('ready');
    setMessage('Wallet eligible. Review and sign the single-use authorization message.');
  }

  async function connectWallet(kind: WalletKind) {
    if (busy) return;
    setWalletKind(kind);
    setChallenge(null);
    setRequestDetails(null);
    setPhase('connecting');
    setMessage(`Connecting to ${kind === 'trust' ? 'Trust Wallet' : 'TronLink'}...`);

    try {
      let address = '';
      if (kind === 'trust') {
        const trustWallet = getTrustWallet();
        if (!trustWallet.provider && !isTrustBrowser()) {
          if (isMobileBrowser()) {
            setPhase('redirecting');
            setMessage('Opening this page inside Trust Wallet DApp Browser...');
            window.location.assign(getTrustDappUrl());
            return;
          }
          throw new Error('Open this page on your phone, then choose Trust Wallet to continue in its DApp Browser.');
        }

        if (trustWallet.provider) {
          await trustWallet.provider.request({ method: 'tron_requestAccounts' });
          address = await waitForTrustAddress(trustAdapter);
        } else {
          throw new Error('Trust Wallet was not detected in this browser. Open this page inside Trust Wallet DApp Browser.');
        }
      } else {
        const wallet = getTronLink();
        if (!wallet.provider) {
          if (isMobileBrowser()) {
            setPhase('redirecting');
            setMessage('Opening this page inside TronLink DApp Browser...');
            window.location.assign(getTronLinkDappUrl());
            return;
          }
          throw new Error('TronLink was not detected. Open this page inside TronLink or install its browser extension.');
        }
        const accounts = await wallet.provider.request({
          method: wallet.isLegacy ? 'tron_requestAccounts' : 'eth_requestAccounts',
        });
        const refreshedWallet = getTronLink();
        const responseAddress = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
        address = refreshedWallet.tronWeb?.defaultAddress?.base58 || responseAddress;
      }

      if (!address) {
        throw new Error(
          kind === 'trust'
            ? 'Trust Wallet did not provide a TRON account. Open this page inside Trust Wallet DApp Browser and select a TRON wallet.'
            : 'The wallet did not provide an active TRON account.',
        );
      }
      setConnectedWallet(address);
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
        const { tronWeb } = getTrustWallet();
        if (tronWeb?.trx?.signMessageV2) {
          signature = await tronWeb.trx.signMessageV2(challenge.message);
        } else {
          signature = await trustAdapter.signMessage(challenge.message);
        }
      } else {
        const { tronWeb } = getTronLink();
        if (!tronWeb) throw new Error('The TronLink connection is no longer available.');
        signature = await tronWeb.trx.signMessageV2(challenge.message);
      }

      setPhase('verifying');
      setMessage('Verifying the recovered signer and recording the one-time authorization...');
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.id,
          walletAddress: connectedWallet,
          signature,
        }),
      });
      const result = await readResponse<{ verified: boolean; statusUrl: string }>(response);

      setChallenge(null);
      setPhase('redirecting');
      setMessage('Signature verified. Opening the processing status...');
      window.location.assign(result.statusUrl);
    } catch (error) {
      setPhase('ready');
      setMessage(error instanceof Error ? error.message : 'The signature was declined or could not be verified.');
    }
  }

  return (
    <div className="authorization-grid">
      <section className="summary-panel">
        <div className="summary-heading">
          <span className="section-label">AUTHORIZATION REQUEST</span>
          <span className={`pending-badge ${requestDetails ? 'eligible-badge' : ''}`}>
            <i /> {requestDetails ? 'Wallet eligible' : 'Details locked'}
          </span>
        </div>
        <h2>{requestDetails ? 'Request unlocked' : 'Connect to reveal details'}</h2>
        <p className="section-copy">
          The amount and sender account become visible only after the server accepts the connected wallet.
        </p>

        <dl className="request-details">
          <div><dt>Network</dt><dd><span className="network-icon">T</span> TRON Mainnet</dd></div>
          <div><dt>Asset</dt><dd>{requestDetails?.asset || 'TRC20 asset'}</dd></div>
          <div>
            <dt>Amount</dt>
            <dd className={requestDetails ? 'amount' : 'locked-value'}>
              {requestDetails ? <>{displayAmount(requestDetails.amount)} <small>{requestDetails.asset}</small></> : 'LOCKED'}
            </dd>
          </div>
          <div>
            <dt>Sender</dt>
            <dd className={requestDetails ? 'mono' : 'locked-value'}>
              {requestDetails ? shortenAddress(requestDetails.senderWallet) : 'LOCKED'}
            </dd>
          </div>
          <div><dt>Signature policy</dt><dd>One verified signature</dd></div>
          {requestDetails && <div><dt>Reference</dt><dd className="mono">{requestDetails.reference}</dd></div>}
        </dl>
      </section>

      <section className="wallet-panel">
        <span className="section-label">WALLET ELIGIBILITY</span>
        <h2>Connect securely</h2>
        <p className="section-copy">Only a configured wallet can unlock its request and sign once.</p>

        <div className="wallet-options">
          <button
            type="button"
            className={`wallet-option trust-option ${walletKind === 'trust' ? 'selected' : ''}`}
            onClick={() => connectWallet('trust')}
            disabled={busy}
          >
            <Image src={trustAdapter.icon} width={34} height={34} alt="Trust Wallet" unoptimized />
            <span><strong>Trust Wallet</strong><small>Connect through the mobile DApp Browser</small></span>
            <b>Connect</b>
          </button>
          <button
            type="button"
            className={`wallet-option tronlink-option ${walletKind === 'tronlink' ? 'selected' : ''}`}
            onClick={() => connectWallet('tronlink')}
            disabled={busy}
          >
            <Image src="/tron-logo.png" width={34} height={34} alt="TronLink" />
            <span><strong>TronLink</strong><small>Connect with the installed wallet or DApp Browser</small></span>
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
              <summary>Review single-use message</summary>
              <pre>{challenge.displayMessage}</pre>
            </details>
            <button className="sign-button" type="button" onClick={signChallenge}>
              Sign once and continue <span>→</span>
            </button>
            <small>Expires at {new Date(challenge.expiresAt).toLocaleTimeString('en-US')}</small>
          </div>
        )}

        <div className="security-note">
          <span>◆</span>
          <p>
            <strong>One message signature only.</strong> The server rejects every later signing attempt from the same wallet.
            A network transaction is reported only after a real broadcast and TXID.
          </p>
        </div>
      </section>
    </div>
  );
}
