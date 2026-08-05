'use client';

import { useEffect, useState } from 'react';
import { getCachedUser } from '@/lib/dataCache';
import { createClient } from '@/lib/supabase/client';
import { getFinancialCurrentPeriod } from '@/lib/financialPeriod';

// Período financeiro corrente do usuário (respeita profiles.financial_start_day).
// Espelha o que a Home já faz em loadUserAndProfile(). Enquanto `loading` for
// true o periodKey é provisório (mês de calendário) — quem usa para decidir
// alerta deve esperar, senão pisca um aviso calculado no período errado.
export function useFinancialPeriod() {
  const [startDay, setStartDay] = useState<number | null>(null);
  const [periodKey, setPeriodKey] = useState<string>(() => getFinancialCurrentPeriod(null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await getCachedUser();
        if (!user || cancelled) return;
        const supabase = createClient();
        const { data } = await supabase
          .from('profiles')
          .select('financial_start_day')
          .eq('id', user.id)
          .single();
        if (cancelled) return;
        // Usuário sem perfil / sem a coluna preenchida → null → mês de calendário.
        const day = (data?.financial_start_day as number | null) ?? null;
        setStartDay(day);
        setPeriodKey(getFinancialCurrentPeriod(day));
      } catch {
        // Falha de rede/perfil não pode travar a tela: mantém o default (null).
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { periodKey, startDay, loading };
}
