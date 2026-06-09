'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { ROUNDUP_EVENT, type RoundUpSavedDetail } from '@/lib/mission/roundup';

// Aviso transparente do round-up (M5): "🎯 Arredondei e guardei R$X na sua
// Missão!". Global no layout, padrão dos demais toasts. Só dispara quando um
// micro-aporte é efetivado (diff > 0).
interface Pop {
  id: number;
  amount: number;
}

let _counter = 0;

export default function RoundUpToast() {
  const [pops, setPops] = useState<Pop[]>([]);

  useEffect(() => {
    function onSaved(e: Event) {
      const detail = (e as CustomEvent<RoundUpSavedDetail>).detail;
      if (!detail?.amount || detail.amount <= 0) return;
      const id = ++_counter;
      setPops((prev) => [...prev, { id, amount: detail.amount }]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 4500);
    }
    window.addEventListener(ROUNDUP_EVENT, onSaved);
    return () => window.removeEventListener(ROUNDUP_EVENT, onSaved);
  }, []);

  if (pops.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 61,
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
          className="roundup-toast-pop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            border: '1px solid var(--accent)',
            borderRadius: 20,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text)',
            boxShadow: 'var(--card-shadow)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>🎯 Arredondei e guardei {formatCurrency(p.amount)} na sua Missão!</span>
        </div>
      ))}
      <style>{`
        @keyframes roundupToastPop {
          0%   { opacity: 0; transform: translateY(8px) scale(0.9); }
          12%  { opacity: 1; transform: translateY(0) scale(1); }
          85%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
        .roundup-toast-pop {
          animation: roundupToastPop 4.5s ease-in-out both;
        }
      `}</style>
    </div>
  );
}
