'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    const trackWaiting = (reg: ServiceWorkerRegistration) => {
      if (cancelled) return;
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaiting(reg.waiting);
        return;
      }
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (
          installing.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          setWaiting(installing);
        }
      });
    };

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        trackWaiting(reg);
        reg.addEventListener('updatefound', () => trackWaiting(reg));
      } catch (err) {
        console.error('[sw] registro falhou:', err);
      }
    })();

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange
    );

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange
      );
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[92vw] flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium"
      style={{
        background: 'var(--surface)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <RefreshCw size={15} style={{ color: 'var(--accent)' }} />
      <span>Nova versão disponível</span>
      <button
        type="button"
        onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
        className="ml-1 px-3 py-1 rounded-full text-white text-xs font-semibold"
        style={{ background: 'var(--accent)' }}
      >
        Atualizar
      </button>
    </div>
  );
}
