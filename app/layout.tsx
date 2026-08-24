import type { Metadata } from 'next';
import './globals.css';

const metadataOrigin = process.env.SITE_ORIGIN || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'TRON Proof | Wallet Ownership Verification',
  description: 'Secure, one-time TRON wallet ownership verification without creating or broadcasting a transaction.',
  metadataBase: new URL(metadataOrigin),
  openGraph: {
    title: 'TRON PROOF',
    description: 'Secure wallet ownership verification',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'TRON PROOF secure wallet ownership verification' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TRON PROOF',
    description: 'Secure wallet ownership verification',
    images: ['/og.png'],
  },
  icons: {
    icon: '/tron-logo.png',
    apple: '/tron-logo.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
