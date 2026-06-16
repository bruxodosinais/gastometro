'use client';

import { useEffect, useState } from 'react';
import { CELEBRATE_EVENT, type CelebrateDetail } from '@/lib/notifications/celebrate';

// Toast GLOBAL de reforço (mensagem-only, sem ícone/+N). Substitui o CoinToast
// após a remoção das moedas — usado por aporte e conclusão de desafio. Montado
// 1x no layout; escuta CELEBRATE_EVENT.
interface Pop {
  id: number;
  message: string;
}

let _counter = 0;

export default function AchievementToast() {
  const [pops, setPops] = useState<Pop[]>([]);

  useEffect(() => {
    function onCelebrate(e: Event) {
      const detail = (e as CustomEvent<CelebrateDetail>).detail;
      if (!detail?.message) return;
      const id = ++_counter;
      setPops((prev) => [...prev, { id, message: detail.message }]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 3500);
    }
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
  }, []);

  if (pops.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
        maxWidth: '92vw',
      }}
    >
      {pops.map((p) => (
        <div
          key={p.id}
          className="achievement-toast-pop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface)',
            border: '1px solid var(--accent)',
            borderRadius: 20,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--text)',
            boxShadow: 'var(--card-shadow)',
            whiteSpace: 'nowrap',
          }}
        >
          {p.message}
        </div>
      ))}
      <style>{`
        @keyframes achievementToastPop {
          0%   { opacity: 0; transform: translateY(6px) scale(0.9); }
          15%  { opacity: 1; transform: translateY(0) scale(1); }
          80%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.95); }
        }
        .achievement-toast-pop {
          animation: achievementToastPop 3.5s ease-in-out both;
        }
      `}</style>
    </div>
  );
}
