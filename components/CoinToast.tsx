'use client';

import { useEffect, useState } from 'react';
import { COIN_AWARD_EVENT, type CoinAwardDetail } from '@/lib/gamification/coins';
import CoinIcon from '@/components/CoinIcon';

// Toast GLOBAL do dopamine loop. Montado 1x no layout autenticado, escuta o
// COIN_AWARD_EVENT (disparado por earnCoins quando o crédito > 0) e mostra um
// "+N 🪙" leve que some sozinho. Global (e não o useToast por-tela) porque o
// crédito de app_open vem do RecurringCheck, que vive no layout e não tem UI
// de toast. Ganho 0 (idempotência) não dispara evento, então nada aparece.
interface CoinPop {
  id: number;
  amount: number;
  label?: string;
}

let _counter = 0;

export default function CoinToast() {
  const [pops, setPops] = useState<CoinPop[]>([]);

  useEffect(() => {
    function onAward(e: Event) {
      const detail = (e as CustomEvent<CoinAwardDetail>).detail;
      if (!detail?.amount || detail.amount <= 0) return;
      const id = ++_counter;
      setPops((prev) => [...prev, { id, amount: detail.amount, label: detail.label }]);
      setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.id !== id));
      }, 2200);
    }
    window.addEventListener(COIN_AWARD_EVENT, onAward);
    return () => window.removeEventListener(COIN_AWARD_EVENT, onAward);
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
      }}
    >
      {pops.map((p) => (
        <div
          key={p.id}
          className="coin-toast-pop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface)',
            border: '1px solid #FFB800',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--text)',
            boxShadow: 'var(--card-shadow)',
            whiteSpace: 'nowrap',
          }}
        >
          {p.label && <span>{p.label}</span>}
          <CoinIcon size={18} />
          <span>+{p.amount}</span>
        </div>
      ))}
      <style>{`
        @keyframes coinToastPop {
          0%   { opacity: 0; transform: translateY(6px) scale(0.9); }
          15%  { opacity: 1; transform: translateY(0) scale(1); }
          80%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.95); }
        }
        .coin-toast-pop {
          animation: coinToastPop 2.2s ease-in-out both;
        }
      `}</style>
    </div>
  );
}
