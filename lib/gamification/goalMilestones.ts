import { createClient } from '../supabase/client';
import { cachedFetch, getCachedUser, invalidate, TTL } from '../dataCache';
import type { GoalMilestone } from './types';

// Marcos da META de poupança (M2): 25/50/75/100% → moedas. Server-authoritative
// (a RPC recomputa o total e valida posse), idempotente por missão. Mesma
// estética de celebração do Item 4a (toast global + evento), mas sobre o % da meta.

export interface GoalMilestoneDef {
  percent: number;
  coins: number;
  name: string;
}

// Os valores de moeda têm que bater com os fixados na RPC claim_goal_milestone
// (o servidor é a autoridade; metas < R$1.000 são zeradas lá pelo anti-farming).
export const GOAL_MILESTONE_DEFS: GoalMilestoneDef[] = [
  { percent: 25, coins: 100, name: 'Primeiro quarto' },
  { percent: 50, coins: 250, name: 'Metade' },
  { percent: 75, coins: 500, name: 'Reta final' },
  { percent: 100, coins: 1000, name: 'Meta batida' },
];

// Celebração agrupada: o GoalMilestoneToast festeja e o useCoins sobe o badge
// (por aqui, não por COIN_AWARD_EVENT, pra não empilhar um 2º toast de moeda).
export const GOAL_MILESTONE_EVENT = 'goalMilestone:unlocked';
export interface GoalMilestoneItem {
  percent: number;
  coins: number;
}
export interface GoalMilestoneUnlockedDetail {
  milestones: GoalMilestoneItem[]; // ordenados por percent crescente
  totalCoins: number;
}

function toGoalMilestone(row: Record<string, unknown>): GoalMilestone {
  return {
    id: row.id as string,
    missionId: row.mission_id as string,
    userId: row.user_id as string,
    percent: row.percent as number,
    unlockedAt: row.unlocked_at as string,
    rewardCoins: row.reward_coins as number,
  };
}

// Marcos de meta já reivindicados de uma missão (cache 'goalMilestones:').
export async function getGoalMilestones(missionId: string): Promise<GoalMilestone[]> {
  return cachedFetch(`goalMilestones:${missionId}`, TTL.LIST, async () => {
    const { data, error } = await createClient()
      .from('mission_goal_milestones')
      .select('*')
      .eq('mission_id', missionId);
    if (error || !data) return [];
    return data.map(toGoalMilestone);
  });
}

// Reivindica um marco específico. Servidor valida atingimento + posse + idempotência.
// Retorna o resultado (ou null em erro). Nunca lança.
export async function claimGoalMilestone(
  missionId: string,
  percent: number
): Promise<{ unlocked: boolean; percent?: number; coins?: number } | null> {
  try {
    const { data, error } = await createClient().rpc('claim_goal_milestone', {
      p_mission_id: missionId,
      p_percent: percent,
    });
    if (error) {
      console.warn('claimGoalMilestone: falhou:', error.message);
      return null;
    }
    const res = data as { unlocked?: boolean; percent?: number; coins?: number } | null;
    return { unlocked: res?.unlocked === true, percent: res?.percent, coins: res?.coins };
  } catch (e) {
    console.warn('claimGoalMilestone: erro inesperado:', e);
    return null;
  }
}

// Reivindica todos os marcos <= currentPercent ainda não reivindicados, e dispara
// UMA celebração agrupada (evita empilhar modais/toasts no caso retroativo, ex.:
// quem já está em 76% reivindica 25/50/75 de uma vez). Fire-and-forget: nunca lança.
// Dedupe em voo por missão: o dashboard pode chamar isto concorrentemente
// (StrictMode remonta o efeito → loadAll 2x). Sem o guard, duas execuções
// disputavam os marcos pendentes e cada uma reivindicava um subconjunto (a RPC
// é idempotente), disparando DOIS eventos/toasts ("25/75" e "50"). Compartilhar
// uma execução garante UMA agregação → UM toast só.
const claimInflight = new Map<string, Promise<void>>();

export function claimReachedGoalMilestones(
  missionId: string,
  currentPercent: number
): Promise<void> {
  const existing = claimInflight.get(missionId);
  if (existing) return existing;
  const run = runClaimReachedGoalMilestones(missionId, currentPercent).finally(() => {
    claimInflight.delete(missionId);
  });
  claimInflight.set(missionId, run);
  return run;
}

async function runClaimReachedGoalMilestones(
  missionId: string,
  currentPercent: number
): Promise<void> {
  try {
    const user = await getCachedUser();
    if (!user) return;
    const claimed = await getGoalMilestones(missionId);
    const claimedSet = new Set(claimed.map((g) => g.percent));
    const pending = GOAL_MILESTONE_DEFS.filter(
      (d) => d.percent <= currentPercent && !claimedSet.has(d.percent)
    );

    const unlocked: GoalMilestoneItem[] = [];
    for (const def of pending) {
      const res = await claimGoalMilestone(missionId, def.percent);
      if (res?.unlocked) unlocked.push({ percent: res.percent ?? def.percent, coins: res.coins ?? 0 });
    }

    if (unlocked.length > 0) {
      invalidate('coins');
      invalidate('goalMilestones');
      // Ordena por percent crescente para o toast mostrar "25/50/75".
      unlocked.sort((a, b) => a.percent - b.percent);
      const totalCoins = unlocked.reduce((s, u) => s + u.coins, 0);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<GoalMilestoneUnlockedDetail>(GOAL_MILESTONE_EVENT, {
            detail: { milestones: unlocked, totalCoins },
          })
        );
      }
    }
  } catch {
    // fire-and-forget
  }
}
