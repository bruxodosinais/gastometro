'use client';

import { useEffect, useState } from 'react';
import { getAccessStreak, recordActivityToday } from '@/lib/storage/activity';

// Streak de acesso derivado do banco. Registra o dia de hoje e em seguida lê o
// streak — o upsert é idempotente, então registrar antes de ler garante que
// "hoje" já esteja contabilizado mesmo que o RecurringCheck (layout) ainda não
// tenha rodado.
export function useAccessStreak(): { currentStreak: number } {
  const [currentStreak, setCurrentStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await recordActivityToday();
      const streak = await getAccessStreak();
      if (!cancelled) setCurrentStreak(streak);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { currentStreak };
}
