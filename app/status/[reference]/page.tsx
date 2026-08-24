import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import StatusTracker from '@/app/components/status-tracker';

type PageProps = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reference } = await params;
  const shortReference = reference.slice(0, 8).toUpperCase();
  const title = `Authorization ${shortReference} | TRON Proof`;
  const description = 'Verified wallet authorization and network-processing status.';
  return {
    title,
    description,
    openGraph: { title, description, images: [] },
    twitter: { title, description, images: [] },
  };
}

export default async function StatusPage({ params }: PageProps) {
  const { reference } = await params;
  return (
    <main className="status-stage">
      <div className="glow glow-red" />
      <div className="glow glow-blue" />
      <section className="status-window">
        <header className="app-header">
          <Link className="app-identity identity-link" href="/">
            <Image src="/tron-logo.png" width={44} height={44} alt="TRON" priority />
            <div><strong>TRON PROOF</strong><span>Authorization status</span></div>
          </Link>
          <div className="mainnet-status"><i /> MAINNET <span>•</span> STATUS</div>
        </header>
        <StatusTracker referenceId={reference} />
        <footer className="app-footer">
          <span>Status refreshes automatically</span>
          <span>Never share your private key or recovery phrase</span>
        </footer>
      </section>
    </main>
  );
}

