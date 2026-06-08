'use client';

import { useEffect, useState } from 'react';
import { MILESTONE_UNLOCKED_EVENT, type MilestoneUnlockedDetail } from '@/lib/gamification/milestones';
import CoinIcon from '@/components/CoinIcon';

// Celebração GLOBAL de marco de ofensiva (padrão do CoinToast). Montado 1x no
// layout; escuta MILESTONE_UNLOCKED_EVENT (disparado só quando unlocked:true).
interface Pop {
  id: number;
  name: string;
  coins: number;
}

let _counter = 0;

export default function MilestoneToast() {
  const [pops, setPops] = useState<Pop[]>([]);

  useEffect(() => {
    function onUnlock(e: Event) {
      const detail = (e as CustomEvent<MilestoneUnlockedDetail>).detail;
      if (!detail) return;
      const id = ++_counter;
      setPops((prev) => [...prev, { id, name: detail.name, coins: detail.coins }]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 5000);
    }
    window.addEventListener(MILESTONE_UNLOCKED_EVENT, onUnlock);
    return () => window.removeEventListener(MILESTONE_UNLOCKED_EVENT, onUnlock);
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
          className="milestone-toast-pop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            border: '1px solid #FFB800',
            borderRadius: 20,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text)',
            boxShadow: 'var(--card-shadow)',
            whiteSpace: 'nowrap',
          }}
        >
          <span aria-hidden="true">🏆</span>
          <span>{p.name} desbloqueado!</span>
          {p.coins > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              +{p.coins} <CoinIcon size={15} />
            </span>
          )}
        </div>
      ))}
      <style>{`
        @keyframes milestoneToastPop {
          0%   { opacity: 0; transform: translateY(8px) scale(0.85); }
          12%  { opacity: 1; transform: translateY(0) scale(1.04); }
          22%  { transform: translateY(0) scale(1); }
          85%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
        .milestone-toast-pop {
          animation: milestoneToastPop 5s ease-in-out both;
        }
      `}</style>
    </div>
  );
}
