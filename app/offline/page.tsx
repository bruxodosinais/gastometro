import OfflineRetryButton from './OfflineRetryButton';

export const metadata = {
  title: 'Você está offline — TôOrganizado',
};

export default function OfflinePage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl px-6 py-10 text-center"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl"
          style={{ background: 'var(--accent-bg)' }}
          aria-hidden
        >
          📶
        </div>
        <h1 className="mt-5 text-xl font-bold">Você está offline</h1>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: 'var(--text-2)' }}
        >
          Verifique sua conexão. Seus dados ficam salvos quando voltar online.
        </p>
        <OfflineRetryButton />
      </div>
    </main>
  );
}
