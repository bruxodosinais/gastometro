'use client';

import { useEffect, useState } from 'react';
import { getCachedUser } from '@/lib/dataCache';
import { FREEZE_CHANGED_EVENT, type FreezeChangedDetail, getStreakFreezes } from './freezes';

// Lê a quantidade de Streak Freezes para o contador da Home. Carrega 1x no
// mount e atualiza no FREEZE_CHANGED_EVENT (ganho semanal ou compra). Espelha
// o useCoins, mas aqui o evento traz o valor AUTORITATIVO (new_freezes), então
// fazemos set direto em vez de incremento otimista.
export function useStreakFreezes(): { freezes: number } {
  const [freezes, setFreezes] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCachedUser();
      if (!user) return;
      const n = await getStreakFreezes(user.id);
      if (!cancelled) setFreezes(n);
    })();

    function onChange(e: Event) {
      const detail = (e as CustomEvent<FreezeChangedDetail>).detail;
      if (typeof detail?.freezes === 'number') setFreezes(detail.freezes);
    }
    window.addEventListener(FREEZE_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(FREEZE_CHANGED_EVENT, onChange);
    };
  }, []);

  return { freezes };
}
