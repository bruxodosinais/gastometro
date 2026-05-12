import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
import OfflineBanner from '@/components/OfflineBanner';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TôOrganizado',
  description: 'Controle de gastos pessoais com alertas de desperdício por categoria',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full ${nunito.className}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className="min-h-full" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
