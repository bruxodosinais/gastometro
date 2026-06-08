'use client';

import { useEffect, useState } from 'react';
import { FREEZE_SAVED_EVENT } from '@/lib/gamification/freezes';
import FreezeIcon from '@/components/FreezeIcon';

// Toast GLOBAL (padrão do CoinToast) que avisa quando um Streak Freeze foi
// consumido para salvar a ofensiva. Montado 1x no layout; escuta o
// FREEZE_SAVED_EVENT (disparado só quando consumed > 0).
interface Pop {
  id: number;
}

let _counter = 0;

export default function StreakFreezeToast() {
  const [pops, setPops] = useState<Pop[]>([]);

  useEffect(() => {
    function onSaved() {
      const id = ++_counter;
      setPops((prev) => [...prev, { id }]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 4000);
    }
    window.addEventListener(FREEZE_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(FREEZE_SAVED_EVENT, onSaved);
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
          className="freeze-toast-pop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            border: '1px solid #38A8D8',
            borderRadius: 20,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text)',
            boxShadow: 'var(--card-shadow)',
            whiteSpace: 'nowrap',
          }}
        >
          <FreezeIcon size={18} />
          <span>Seu Streak Freeze salvou sua ofensiva!</span>
        </div>
      ))}
      <style>{`
        @keyframes freezeToastPop {
          0%   { opacity: 0; transform: translateY(6px) scale(0.9); }
          12%  { opacity: 1; transform: translateY(0) scale(1); }
          85%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.95); }
        }
        .freeze-toast-pop {
          animation: freezeToastPop 4s ease-in-out both;
        }
      `}</style>
    </div>
  );
}
