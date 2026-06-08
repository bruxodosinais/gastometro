import { createClient } from '../supabase/client';
import { cachedFetch, getCachedUser, invalidate, TTL } from '../dataCache';
import type { StreakMilestone } from './types';

// Streak Milestones (Pilar 3 · Item 4a): detecção + recompensa em moedas + badge.
// Mesmo princípio das outras RPCs — o BANCO valida/recompensa; o cliente só
// pede. 30/365 dão Pro e 100 dá destaque, mas isso é o 4b (aqui só moedas+badge).

export interface MilestoneDef {
  days: number;
  name: string;
  coins: number;
}

// Fonte única de nomes/recompensas para a UI. Os valores de moeda têm que bater
// com os fixados na RPC claim_streak_milestone (o servidor é a autoridade).
export const MILESTONE_DEFS: MilestoneDef[] = [
  { days: 7, name: 'Primeira Semana', coins: 100 },
  { days: 14, name: 'Em Chama', coins: 200 },
  { days: 30, name: 'Inabalável', coins: 300 },
  { days: 60, name: 'Máquina', coins: 500 },
  { days: 100, name: 'Centenário', coins: 1000 },
  { days: 365, name: 'Lendário', coins: 0 },
];

// Evento de celebração: o MilestoneToast global escuta e festeja; o useCoins
// escuta para subir o badge de moeda (sem disparar COIN_AWARD_EVENT, evitando
// um segundo toast de "+N 🪙" sobreposto à celebração). Só dispara unlocked:true.
export const MILESTONE_UNLOCKED_EVENT = 'milestone:unlocked';
export interface MilestoneUnlockedDetail {
  days: number;
  name: string;
  coins: number;
}

function toStreakMilestone(row: Record<string, unknown>): StreakMilestone {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    milestoneDays: row.milestone_days as number,
    unlockedAt: row.unlocked_at as string,
    rewardClaimed: row.reward_claimed as boolean,
  };
}

// Marcos já desbloqueados do usuário (cache 'milestones:').
export async function getStreakMilestones(userId: string): Promise<StreakMilestone[]> {
  return cachedFetch(`milestones:${userId}`, TTL.LIST, async () => {
    const { data, error } = await createClient()
      .from('streak_milestones')
      .select('*')
      .eq('user_id', userId);
    if (error || !data) return [];
    return data.map(toStreakMilestone);
  });
}

// Reivindica um marco. O servidor recomputa o streak e só concede se atingido
// de verdade (anti-cheat) e ainda não concedido (idempotente). Em unlocked:true:
// invalida caches, sobe o badge de moeda e dispara a celebração. Nunca lança.
export async function claimStreakMilestone(days: number): Promise<void> {
  try {
    const { data, error } = await createClient().rpc('claim_streak_milestone', {
      p_milestone_days: days,
    });
    if (error) {
      console.warn('claimStreakMilestone: falhou:', error.message);
      return;
    }
    const res = data as { unlocked?: boolean; milestone_days?: number; coins?: number } | null;
    if (res?.unlocked === true) {
      invalidate('coins');
      invalidate('milestones');
      const def = MILESTONE_DEFS.find((d) => d.days === (res.milestone_days ?? days));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<MilestoneUnlockedDetail>(MILESTONE_UNLOCKED_EVENT, {
            detail: {
              days: res.milestone_days ?? days,
              name: def?.name ?? `${days} dias`,
              coins: res.coins ?? 0,
            },
          })
        );
      }
    }
  } catch (e) {
    console.warn('claimStreakMilestone: erro inesperado:', e);
  }
}

// Reivindica todos os marcos <= streak atual ainda não desbloqueados. Busca os
// já desbloqueados primeiro para evitar RPCs desnecessárias (o servidor também
// é idempotente). Fire-and-forget: nunca lança.
export async function claimReachedMilestones(streak: number): Promise<void> {
  try {
    const user = await getCachedUser();
    if (!user) return;
    const unlocked = await getStreakMilestones(user.id);
    const unlockedSet = new Set(unlocked.map((m) => m.milestoneDays));
    const pending = MILESTONE_DEFS.filter((d) => d.days <= streak && !unlockedSet.has(d.days));
    for (const def of pending) {
      await claimStreakMilestone(def.days);
    }
  } catch {
    // fire-and-forget
  }
}
