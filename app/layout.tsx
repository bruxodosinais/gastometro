import type { Metadata } from 'next';
import './globals.css';
import OfflineBanner from '@/components/OfflineBanner';

export const metadata: Metadata = {
  title: 'GastôMetro',
  description: 'Controle de gastos pessoais com alertas de desperdício por categoria',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className="min-h-full bg-[#F9FAFB] text-gray-900">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
