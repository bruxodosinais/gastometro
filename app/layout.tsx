import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
import OfflineBanner from '@/components/OfflineBanner';
import CookieBanner from '@/components/CookieBanner';
import CouponCapture from '@/components/CouponCapture';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import IOSInstallBanner from '@/components/IOSInstallBanner';
import { ThemeProvider } from '@/lib/themeContext';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

const description =
  'Controle de gastos pessoais com alertas de desperdício por categoria';

// Os assets de marca (favicon.ico, icon.svg, apple-icon.png, opengraph-image.png,
// twitter-image.png e manifest.ts) ficam na raiz de `app/` como file conventions
// do Next 16 — os <link>/<meta> de ícone, manifesto e OG são injetados
// automaticamente, não precisam ser declarados aqui.
export const metadata: Metadata = {
  metadataBase: new URL('https://www.toorganizado.com.br'),
  applicationName: 'TôOrganizado',
  title: 'TôOrganizado',
  description,
  appleWebApp: {
    capable: true,
    title: 'TôOrganizado',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'TôOrganizado',
    title: 'TôOrganizado',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TôOrganizado',
    description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#5B5BD6' },
    { media: '(prefers-color-scheme: dark)', color: '#14141A' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full ${nunito.className}`} suppressHydrationWarning>
      <body className="min-h-full" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <ThemeProvider>
          <ServiceWorkerRegister />
          <IOSInstallBanner />
          <OfflineBanner />
          <CouponCapture />
          {children}
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
