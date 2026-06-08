'use client';

import { useEffect, useState } from 'react';
import { getAccessStreak, recordActivityToday, todayLocalStr } from '@/lib/storage/activity';
import { consumeFreezeForGap } from '@/lib/gamification/freezes';
import { claimReachedMilestones } from '@/lib/gamification/milestones';

// Streak de acesso derivado do banco. Registra o dia de hoje e em seguida lê o
// streak — o upsert é idempotente, então registrar antes de ler garante que
// "hoje" já esteja contabilizado mesmo que o RecurringCheck (layout) ainda não
// tenha rodado.
export function useAccessStreak(): { currentStreak: number } {
  const [currentStreak, setCurrentStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = todayLocalStr();
      await recordActivityToday();
      // 3b: ponteia dias perdidos com freeze ANTES de ler, pro badge já refletir
      // a ofensiva preservada no mesmo render. Mesma string de "hoje" do registro.
      await consumeFreezeForGap(today);
      const streak = await getAccessStreak();
      if (!cancelled) setCurrentStreak(streak);
      // 4a: com o streak já correto (pós-consume), reivindica marcos atingidos.
      // Fire-and-forget; a RPC valida no servidor e é idempotente.
      claimReachedMilestones(streak).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { currentStreak };
}
