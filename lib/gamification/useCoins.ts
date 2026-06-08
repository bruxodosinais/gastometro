'use client';

import { useEffect, useState } from 'react';
import { getCachedUser } from '@/lib/dataCache';
import { COIN_AWARD_EVENT, type CoinAwardDetail, getCoinBalance } from './coins';
import { MILESTONE_UNLOCKED_EVENT, type MilestoneUnlockedDetail } from './milestones';
import { GOAL_MILESTONE_EVENT, type GoalMilestoneUnlockedDetail } from './goalMilestones';

// Lê o saldo de moedas do usuário para o badge da Home. Carrega 1x no mount e,
// a cada crédito confirmado (COIN_AWARD_EVENT), incrementa de forma otimista —
// o valor autoritativo do banco é relido no próximo mount/navegação (o cache
// 'coins:' já foi invalidado por earnCoins). Sem refetch no evento para não
// duplicar a contagem nem disparar query a cada ganho.
//
// Também escuta MILESTONE_UNLOCKED_EVENT: a recompensa de marco sobe o badge por
// AQUI (não por COIN_AWARD_EVENT) para não disparar um 2º toast de "+N 🪙" em
// cima da celebração do marco.
export function useCoins(): { balance: number } {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCachedUser();
      if (!user) return;
      const coins = await getCoinBalance(user.id);
      if (!cancelled) setBalance(coins?.balance ?? 0);
    })();

    function onAward(e: Event) {
      const detail = (e as CustomEvent<CoinAwardDetail>).detail;
      if (detail?.amount) setBalance((b) => b + detail.amount);
    }
    function onMilestone(e: Event) {
      const detail = (e as CustomEvent<MilestoneUnlockedDetail>).detail;
      if (detail?.coins) setBalance((b) => b + detail.coins);
    }
    function onGoalMilestone(e: Event) {
      const detail = (e as CustomEvent<GoalMilestoneUnlockedDetail>).detail;
      if (detail?.totalCoins) setBalance((b) => b + detail.totalCoins);
    }
    window.addEventListener(COIN_AWARD_EVENT, onAward);
    window.addEventListener(MILESTONE_UNLOCKED_EVENT, onMilestone);
    window.addEventListener(GOAL_MILESTONE_EVENT, onGoalMilestone);
    return () => {
      cancelled = true;
      window.removeEventListener(COIN_AWARD_EVENT, onAward);
      window.removeEventListener(MILESTONE_UNLOCKED_EVENT, onMilestone);
      window.removeEventListener(GOAL_MILESTONE_EVENT, onGoalMilestone);
    };
  }, []);

  return { balance };
}
