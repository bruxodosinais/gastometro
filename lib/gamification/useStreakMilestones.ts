'use client';

import { useEffect, useState } from 'react';
import { getCachedUser } from '@/lib/dataCache';
import {
  MILESTONE_UNLOCKED_EVENT,
  type MilestoneUnlockedDetail,
  getStreakMilestones,
} from './milestones';

// Lista os dias de marco já desbloqueados (para a seção de badges). Carrega no
// mount e adiciona em tempo real quando um marco é desbloqueado (evento).
export function useStreakMilestones(): { unlocked: number[] } {
  const [unlocked, setUnlocked] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCachedUser();
      if (!user) return;
      const rows = await getStreakMilestones(user.id);
      if (!cancelled) setUnlocked(rows.map((m) => m.milestoneDays));
    })();

    function onUnlock(e: Event) {
      const detail = (e as CustomEvent<MilestoneUnlockedDetail>).detail;
      if (typeof detail?.days === 'number') {
        setUnlocked((prev) => (prev.includes(detail.days) ? prev : [...prev, detail.days]));
      }
    }
    window.addEventListener(MILESTONE_UNLOCKED_EVENT, onUnlock);
    return () => {
      cancelled = true;
      window.removeEventListener(MILESTONE_UNLOCKED_EVENT, onUnlock);
    };
  }, []);

  return { unlocked };
}
