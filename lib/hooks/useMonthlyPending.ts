'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  getMonthlyObligations,
  getRecurringExpenses,
  getExpenses,
  checkAndGenerateObligations,
} from '@/lib/storage';

// Pendências do mês corrente, centralizadas (antes duplicado em Sidebar,
// TopbarDesktop e TopbarMobile): obrigações 'pending' cujo dia já chegou +
// receitas recorrentes ativas ainda não recebidas cujo dia já chegou.
// Recalcula a cada mudança de rota para manter o badge/dot em dia (os dados
// vêm do dataCache, então o custo é desprezível).
export function useMonthlyPending(): number {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await checkAndGenerateObligations();
        const monthKey = new Date().toISOString().slice(0, 7);
        const [obs, recs, exp] = await Promise.all([
          getMonthlyObligations(monthKey),
          getRecurringExpenses(),
          getExpenses(),
        ]);
        if (!mounted) return;
        const today = new Date().getDate();
        const isDayReached = (dom?: number) => dom == null || dom <= today;
        const pendingObs = obs.filter(o => o.status === 'pending').filter(o => {
          const rec = recs.find(r => r.id === o.recurringExpenseId);
          return rec ? isDayReached(rec.dayOfMonth) : true;
        }).length;
        const receivedIds = new Set(
          exp.filter(e => e.date.slice(0, 7) === monthKey && e.type === 'income' && e.recurringExpenseId)
             .map(e => e.recurringExpenseId as string)
        );
        const pendingIncome = recs
          .filter(r => r.active && r.type === 'income')
          .filter(r => !receivedIds.has(r.id) && isDayReached(r.dayOfMonth)).length;
        setPending(pendingObs + pendingIncome);
      } catch {
        if (mounted) setPending(0);
      }
    })();
    return () => { mounted = false; };
  }, [pathname]);

  return pending;
}
