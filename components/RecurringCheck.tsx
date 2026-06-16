'use client';

import { useEffect } from 'react';
import { checkAndGenerateObligations, recordActivityToday, todayLocalStr } from '@/lib/storage';
import { consumeFreezeForGap, grantWeeklyFreeze } from '@/lib/gamification/freezes';

export default function RecurringCheck() {
  useEffect(() => {
    checkAndGenerateObligations();
    // Streak de acesso: conta o dia em qualquer página autenticada, não só a Home.
    recordActivityToday();
    // +1 🧊 grátis na 1ª visita da semana. Idempotência por SEMANA ISO na RPC;
    // chamar todo load é seguro (no-op fora da 1ª vez). Fire-and-forget.
    grantWeeklyFreeze().catch(() => {});
    // 3b: ponteia dias perdidos com freeze também fora da Home. A RPC só olha
    // dias ANTES de hoje, então independe da ordem com recordActivityToday.
    // Idempotente (FOR UPDATE + dias já ponteados). Fire-and-forget.
    consumeFreezeForGap(todayLocalStr()).catch(() => {});
  }, []);
  return null;
}
