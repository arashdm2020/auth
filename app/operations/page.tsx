import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import OperationsPanel from '@/app/components/operations-panel';

export const metadata: Metadata = {
  title: 'Operations | TRON Proof',
  description: 'Restricted TRON authorization records and base-wallet balance.',
  robots: { index: false, follow: false },
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function OperationsPage() {
  return (
    <main className="operations-stage">
      <div className="glow glow-red" />
      <div className="glow glow-blue" />
      <section className="operations-window">
        <header className="app-header">
          <Link className="app-identity identity-link" href="/">
            <Image src="/tron-logo.png" width={44} height={44} alt="TRON" priority />
            <div><strong>TRON PROOF</strong><span>Restricted operations</span></div>
          </Link>
          <div className="mainnet-status"><i /> MAINNET <span>•</span> ADMIN</div>
        </header>
        <OperationsPanel />
        <footer className="app-footer">
          <span>Server-authorized access only</span>
          <span>Balance data is read from TRON API</span>
        </footer>
      </section>
    </main>
  );
}

