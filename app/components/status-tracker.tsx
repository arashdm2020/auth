'use client';

import { useEffect, useMemo, useState } from 'react';

type StatusData = {
  referenceId: string;
  requestReference: string;
  wallet: string;
  amount: string;
  asset: string;
  senderWallet: string;
  receiverWallet: string;
  verifiedAt: number;
  processingDeadline: number;
  networkStatus: string;
  txid: string | null;
  submittedAt: number | null;
  confirmedAt: number | null;
  creditedAt: number | null;
  updatedAt: number;
};

function formatAmount(amount: string) {
  const value = Number(amount);
  return Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)
    : amount;
}

function formatTime(timestamp: number | null) {
  return timestamp ? new Date(timestamp).toLocaleString('en-US') : '—';
}

function stageFor(status: string) {
  if (status === 'credited') return 4;
  if (status === 'confirmed') return 3;
  if (status === 'submitted') return 2;
  return 1;
}

function countdown(deadline: number, now: number) {
  const remaining = Math.max(0, deadline - now);
  if (remaining === 0) return 'Target window elapsed';
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function StatusTracker({ referenceId }: { referenceId: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const [showNetworkLink, setShowNetworkLink] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/status/${encodeURIComponent(referenceId)}`, { cache: 'no-store' });
        const payload = await response.json() as StatusData & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Status could not be loaded.');
        if (active) {
          setData(payload);
          setError('');
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Status could not be loaded.');
      }
    }
    void load();
    const poller = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(poller);
    };
  }, [referenceId]);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setShowNetworkLink(false);
    if (!data) return;
    const timer = window.setTimeout(() => setShowNetworkLink(true), 5_000);
    return () => window.clearTimeout(timer);
  }, [data?.referenceId]);

  const stage = useMemo(() => stageFor(data?.networkStatus || ''), [data?.networkStatus]);

  if (error) {
    return <div className="status-error-card" role="alert"><strong>Status unavailable</strong><p>{error}</p></div>;
  }
  if (!data) {
    return <div className="status-loading" role="status">Loading verified authorization…</div>;
  }

  const broadcastRecorded = stage >= 2 && Boolean(data.txid);
  const confirmed = stage >= 3 && Boolean(data.confirmedAt);
  const credited = stage >= 4 && Boolean(data.creditedAt);
  const tronscanUrl = `https://tronscan.org/#/address/${encodeURIComponent(data.senderWallet)}`;

  return (
    <div className="status-content">
      <section className="status-hero">
        <div>
          <span className="verified-pill"><i /> SIGNATURE VERIFIED</span>
          <h1>Authorization recorded</h1>
          <p>The wallet completed its single permitted signature. This record now tracks the separate network-processing lifecycle.</p>
        </div>
        <div className="processing-clock">
          <span>PROCESSING TARGET</span>
          <strong>{countdown(data.processingDeadline, now)}</strong>
          <small>Up to 16 hours from wallet signature time</small>
        </div>
      </section>

      <section className="status-table-card">
        <div className="status-table-heading">
          <div><span className="section-label">REQUEST STATUS</span><h2>{data.requestReference}</h2></div>
          <span className="live-badge"><i /> LIVE RECORD</span>
        </div>

        <div className="transaction-summary">
          <div><span>Amount</span><strong>{formatAmount(data.amount)} <small>{data.asset}</small></strong></div>
          <div><span>Sender</span><strong className="mono">{`${data.senderWallet.slice(0, 7)}…${data.senderWallet.slice(-6)}`}</strong></div>
          <div><span>Authorized wallet</span><strong className="mono">{data.wallet}</strong></div>
        </div>

        <div className="status-table-wrap">
          <table className="status-table">
            <thead><tr><th>Stage</th><th>Status</th><th>Timestamp</th></tr></thead>
            <tbody>
              <tr>
                <td><span className="table-step complete">1</span>Wallet signature</td>
                <td><span className="state-chip complete">Verified</span></td>
                <td>{formatTime(data.verifiedAt)}</td>
              </tr>
              <tr>
                <td><span className={`table-step ${broadcastRecorded ? 'complete' : 'active'}`}>2</span>Network submission</td>
                <td><span className={`state-chip ${broadcastRecorded ? 'complete' : 'pending'}`}>{broadcastRecorded ? 'Broadcast recorded' : 'Awaiting application broadcast'}</span></td>
                <td>{formatTime(data.submittedAt)}</td>
              </tr>
              <tr>
                <td><span className={`table-step ${confirmed ? 'complete' : broadcastRecorded ? 'active' : ''}`}>3</span>First confirmation</td>
                <td><span className={`state-chip ${confirmed ? 'complete' : 'pending'}`}>{confirmed ? 'Confirmed on-chain' : broadcastRecorded ? 'Monitoring TRON' : 'Starts after broadcast'}</span></td>
                <td>{formatTime(data.confirmedAt)}</td>
              </tr>
              <tr>
                <td><span className={`table-step ${credited ? 'complete' : ''}`}>4</span>Account settlement</td>
                <td><span className={`state-chip ${credited ? 'complete' : 'pending'}`}>{credited ? 'Credited' : 'Waiting for confirmation'}</span></td>
                <td>{formatTime(data.creditedAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="txid-display">
          <span>NETWORK VIEW</span>
          {showNetworkLink ? (
            <a href={tronscanUrl} target="_blank" rel="noreferrer">Open sender wallet on Tronscan</a>
          ) : (
            <strong>Preparing network reference…</strong>
          )}
        </div>
        <p className="network-truth">
          A verified message signature is not shown as a transaction hash. The network reference opens the base sender wallet on Tronscan.
        </p>
      </section>
    </div>
  );
}
