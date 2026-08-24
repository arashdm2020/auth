import Image from 'next/image';
import WalletVerification from '@/app/components/wallet-verification';

export default function Home() {
  return (
    <main className="dapp-stage">
      <div className="glow glow-red" />
      <div className="glow glow-blue" />

      <section className="dapp-window" aria-label="TRON authorization application">
        <header className="app-header">
          <div className="app-identity">
            <Image src="/tron-logo.png" width={44} height={44} alt="TRON" priority />
            <div>
              <strong>TRON PROOF</strong>
              <span>Secure authorization console</span>
            </div>
          </div>
          <div className="mainnet-status"><i /> MAINNET <span>•</span> SECURE SESSION</div>
        </header>

        <WalletVerification />

        <footer className="app-footer">
          <span>Protected by one-time challenge verification</span>
          <span>Never share your private key or recovery phrase</span>
        </footer>
      </section>
    </main>
  );
}
