'use client';

import { FormEvent, useState } from 'react';

type OperationRecord = {
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

type AuthorizedWallet = {
  wallet: string;
  amount: string;
  asset: string;
  senderWallet: string;
  receiverWallet: string;
  requestReference: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  signedAt: number | null;
};

type OperationsData = {
  baseWallet: {
    address: string;
    balanceSun: string;
    balanceTrx: string;
    usdtAtomic: string;
    balanceUsdt: string;
    usdtContract: string;
    fetchedAt: number;
    source: string;
  } | null;
  balanceError: string | null;
  authorizedWallets: AuthorizedWallet[];
  records: OperationRecord[];
};

function compactAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-6)}`;
}

function statusLabel(status: string) {
  if (status === 'credited') return 'Credited';
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'submitted') return 'Submitted';
  return 'Awaiting broadcast';
}

export default function OperationsPanel() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<OperationsData | null>(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState('USDT');
  const [reference, setReference] = useState('');

  async function load(event?: FormEvent) {
    event?.preventDefault();
    if (!token || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/operations', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json() as OperationsData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Operations data could not be loaded.');
      setData(payload);
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : 'Operations data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function addAuthorizedWallet(event: FormEvent) {
    event.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const response = await fetch('/api/authorized-wallets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          walletAddress,
          amount,
          asset,
          reference,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Authorized wallet could not be saved.');
      setWalletAddress('');
      setAmount('');
      setAsset('USDT');
      setReference('');
      setSaveMessage('Authorized wallet saved.');
      await load();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Authorized wallet could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <form className="admin-gate" onSubmit={load}>
        <span className="section-label">RESTRICTED OPERATIONS</span>
        <h1>Open transaction records</h1>
        <p>Enter the server-configured admin access token. It is kept in memory for this tab and is not stored by the page.</p>
        <label htmlFor="admin-token">Admin access token</label>
        <input
          id="admin-token"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Enter access token"
        />
        {error && <div className="gate-error" role="alert">{error}</div>}
        <button type="submit" disabled={loading || !token}>{loading ? 'Checking access…' : 'Open operations'}</button>
      </form>
    );
  }

  return (
    <div className="operations-content">
      <section className="operations-topline">
        <div><span className="section-label">OPERATIONS OVERVIEW</span><h1>Wallet authorizations</h1></div>
        <button type="button" onClick={() => load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh data'}</button>
      </section>

      <section className="balance-card">
        <div>
          <span>BASE WALLET</span>
          <strong>{data.baseWallet ? compactAddress(data.baseWallet.address) : 'Balance unavailable'}</strong>
          <small>{data.baseWallet?.address || data.balanceError}</small>
        </div>
        <div className="balance-value">
          <span>CONFIRMED ASSET BALANCES</span>
          <strong>{data.baseWallet ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(data.baseWallet.balanceUsdt)) : '—'} <small>USDT</small></strong>
          <b>{data.baseWallet ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(data.baseWallet.balanceTrx)) : '—'} TRX</b>
          <small>{data.baseWallet ? `${data.baseWallet.source} · ${new Date(data.baseWallet.fetchedAt).toLocaleString('en-US')}` : 'Check TronGrid configuration'}</small>
        </div>
      </section>

      <section className="authorization-manager">
        <form className="wallet-auth-form" onSubmit={addAuthorizedWallet}>
          <div className="form-heading">
            <span className="section-label">NEW ONE-TIME AUTHORIZATION</span>
            <h2>Add signing permission</h2>
          </div>
          <label>
            Wallet address
            <input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="TRON wallet address" />
          </label>
          <label>
            Amount
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50000" inputMode="decimal" />
          </label>
          <label>
            Asset
            <input value={asset} onChange={(event) => setAsset(event.target.value.toUpperCase())} placeholder="USDT" />
          </label>
          <label>
            Reference
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Auto-generated if empty" />
          </label>
          {saveError && <div className="gate-error" role="alert">{saveError}</div>}
          {saveMessage && <div className="save-message" role="status">{saveMessage}</div>}
          <button type="submit" disabled={saving || !walletAddress || !amount}>{saving ? 'Saving…' : 'Authorize wallet once'}</button>
        </form>

        <section className="records-card authorized-card">
          <div className="records-heading">
            <div><span className="section-label">AUTHORIZED WALLETS</span><h2>{data.authorizedWallets.length} wallet{data.authorizedWallets.length === 1 ? '' : 's'}</h2></div>
            <p>Only these wallets can sign once for the base sender.</p>
          </div>
          <div className="operations-table-wrap">
            <table className="operations-table">
              <thead>
                <tr><th>Authorized wallet</th><th>Amount</th><th>Sender</th><th>Reference</th><th>State</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {data.authorizedWallets.length === 0 ? (
                  <tr><td colSpan={6} className="empty-row">No authorized wallets yet.</td></tr>
                ) : data.authorizedWallets.map((wallet) => (
                  <tr key={wallet.wallet}>
                    <td className="mono" title={wallet.wallet}>{compactAddress(wallet.wallet)}</td>
                    <td>{new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(wallet.amount))} {wallet.asset}</td>
                    <td className="mono" title={wallet.senderWallet}>{compactAddress(wallet.senderWallet)}</td>
                    <td>{wallet.requestReference}</td>
                    <td><span className={`operation-state ${wallet.signedAt ? 'state-credited' : 'state-awaiting_broadcast'}`}>{wallet.signedAt ? 'Used' : 'Ready once'}</span></td>
                    <td>{new Date(wallet.updatedAt).toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="records-card">
        <div className="records-heading">
          <div><span className="section-label">SIGNED REQUESTS</span><h2>{data.records.length} record{data.records.length === 1 ? '' : 's'}</h2></div>
          <p>Each wallet can appear only once.</p>
        </div>
        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr><th>Reference</th><th>Authorized wallet</th><th>Sender</th><th>Amount</th><th>Verified</th><th>Network</th><th>TXID</th></tr>
            </thead>
            <tbody>
              {data.records.length === 0 ? (
                <tr><td colSpan={7} className="empty-row">No verified signatures yet.</td></tr>
              ) : data.records.map((record) => (
                <tr key={record.referenceId}>
                  <td><a href={`/status/${record.referenceId}`}>{record.requestReference}</a></td>
                  <td className="mono" title={record.wallet}>{compactAddress(record.wallet)}</td>
                  <td className="mono" title={record.senderWallet}>{compactAddress(record.senderWallet)}</td>
                  <td>{new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(record.amount))} {record.asset}</td>
                  <td>{new Date(record.verifiedAt).toLocaleString('en-US')}</td>
                  <td><span className={`operation-state state-${record.networkStatus}`}>{statusLabel(record.networkStatus)}</span></td>
                  <td className="mono" title={record.txid || ''}>{record.txid ? `${record.txid.slice(0, 9)}…${record.txid.slice(-7)}` : 'Not assigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="records-note">Network submission is shown only when a real TXID has been recorded by the application.</p>
      </section>
    </div>
  );
}
