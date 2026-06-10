'use client';

import { useEffect, useState } from 'react';
import { getCachedUser } from '@/lib/dataCache';
import { getMission, getTotalSaved } from '@/lib/storage/missions';
import type { MissionContext } from './coach';

export interface MissionContextResult {
  context: MissionContext | null;
  // true enquanto resolve. Distingue "ainda carregando" de "sem Missão" (ambos
  // teriam context=null) — os insights seguram a copy/CTA enquanto loading pra
  // não piscar "Criar Missão" pra quem já tem missão.
  loading: boolean;
}

// Contexto da Missão ATIVA pros insights coach. Tudo via cache
// (getMission/getTotalSaved são cachedFetch) — na Home o MissaoCard já aquece o
// cache, então aqui é praticamente custo zero.
export function useMissionContext(): MissionContextResult {
  const [context, setContext] = useState<MissionContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCachedUser();
        if (!user || cancelled) return;
        const mission = await getMission(user.id);
        if (!mission || cancelled) return;
        const totalSaved = await getTotalSaved(mission.id);
        if (cancelled) return;
        setContext({
          monthlyTarget: mission.monthlyTarget,
          totalSaved,
          targetAmount: mission.targetAmount,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { context, loading };
}
