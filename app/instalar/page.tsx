import type { Metadata } from 'next';
import InstallGuide from './InstallGuide';

export const metadata: Metadata = {
  title: 'Instalar TôOrganizado',
  description:
    'Adicione o TôOrganizado à tela inicial do seu celular e acesse suas finanças como um app.',
};

export default function InstalarPage() {
  return (
    <main
      className="min-h-screen px-4 py-10"
      style={{ background: '#F7F7F5', color: '#1A1A1A' }}
    >
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <img
            src="/icon-192.png"
            alt="TôOrganizado"
            width={64}
            height={64}
            className="mx-auto"
            style={{ borderRadius: 16, border: '1px solid #E5E7EB' }}
          />
          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            Instale o TôOrganizado
          </h1>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: '#6B6B6B' }}
          >
            Acesse suas finanças direto da tela inicial, como um app de verdade.
          </p>
        </header>

        <InstallGuide />

        <footer className="mt-10 text-center">
          <p className="text-xs" style={{ color: '#6B6B6B' }}>
            Depois de instalar, abra pelo ícone na sua tela inicial.
          </p>
          <a
            href="/app"
            className="mt-4 inline-block text-sm font-semibold"
            style={{ color: '#5B5BD6' }}
          >
            ← Voltar ao app
          </a>
        </footer>
      </div>
    </main>
  );
}
