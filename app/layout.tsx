import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GastôMetro',
  description: 'Controle de gastos pessoais com alertas de desperdício por categoria',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
