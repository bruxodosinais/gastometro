'use client';

export default function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-full text-white text-sm font-semibold"
      style={{
        background: 'var(--accent)',
        boxShadow: '0 6px 16px var(--accent-shadow)',
      }}
    >
      Tentar novamente
    </button>
  );
}
