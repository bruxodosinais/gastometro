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
  'O app de finanças pessoais que transforma guardar dinheiro em uma conquista — com desafios, badges e metas que dão vontade de cumprir.';

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
  // Webview edge-to-edge no nativo → ATIVA os env(safe-area-inset-*) que os
  // componentes já usam (Navigation, TopbarMobile, QuizShell, IntroCarousel…).
  // Sem isso os insets resolvem pra 0 e o conteúdo cola sob a Dynamic Island.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full ${nunito.className}`} suppressHydrationWarning>
      <body className="min-h-full" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        {/* Anti-FOUC: aplica o data-theme ANTES da primeira pintura. Sem isso, o
            padrão claro só valeria após a hidratação e o aparelho com o SO no
            escuro piscaria escuro→claro a cada abertura (globals.css escurece via
            prefers-color-scheme quando não há data-theme). 'system' não seta nada,
            de propósito: aí a media query é que decide. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'&&t!=='system')t='light';if(t!=='system')document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}`,
          }}
        />
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
