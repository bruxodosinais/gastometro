'use client';

import { useEffect, useState } from 'react';
import {
  GOAL_MILESTONE_EVENT,
  type GoalMilestoneUnlockedDetail,
} from '@/lib/gamification/goalMilestones';
import CoinIcon from '@/components/CoinIcon';

// Celebração GLOBAL dos marcos da META (M2). Montado 1x no layout; escuta
// GOAL_MILESTONE_EVENT (sempre AGRUPADO — vários marcos retroativos viram 1 toast).
interface Pop {
  id: number;
  percents: number[];
  totalCoins: number;
}

let _counter = 0;

export default function GoalMilestoneToast() {
  const [pops, setPops] = useState<Pop[]>([]);

  useEffect(() => {
    function onUnlock(e: Event) {
      const detail = (e as CustomEvent<GoalMilestoneUnlockedDetail>).detail;
      if (!detail?.milestones?.length) return;
      const id = ++_counter;
      setPops((prev) => [
        ...prev,
        { id, percents: detail.milestones.map((m) => m.percent), totalCoins: detail.totalCoins },
      ]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 5000);
    }
    window.addEventListener(GOAL_MILESTONE_EVENT, onUnlock);
    return () => window.removeEventListener(GOAL_MILESTONE_EVENT, onUnlock);
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
      {pops.map((p) => {
        const label =
          p.percents.length === 1
            ? `🎯 ${p.percents[0]}% da meta!`
            : `🎯 Marcos ${p.percents.join('/')}% da meta!`;
        return (
          <div
            key={p.id}
            className="goal-toast-pop"
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
            <span>{label}</span>
            {p.totalCoins > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                +{p.totalCoins} <CoinIcon size={15} />
              </span>
            )}
          </div>
        );
      })}
      <style>{`
        @keyframes goalToastPop {
          0%   { opacity: 0; transform: translateY(8px) scale(0.85); }
          12%  { opacity: 1; transform: translateY(0) scale(1.04); }
          22%  { transform: translateY(0) scale(1); }
          85%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
        .goal-toast-pop {
          animation: goalToastPop 5s ease-in-out both;
        }
      `}</style>
    </div>
  );
}
