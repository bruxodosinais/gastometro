import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/dataCache';
import { getMonthKey } from '@/lib/calculations';
import { addContribution, getMission, getTotalSaved } from '@/lib/storage/missions';
import { claimReachedGoalMilestones } from '@/lib/gamification/goalMilestones';

// Micro-aporte / Round-up (M5): arredonda o gasto para o próximo múltiplo e
// guarda a diferença na Missão ativa, automaticamente. O micro-aporte avança a
// meta e pode cruzar marcos LEGÍTIMOS (M2, já anti-farmados por meta mínima),
// mas NÃO dá o +50 🪙 do aporte manual (anti-farming por gasto). Só GASTO
// manual — nunca receita, seed, auto-income ou fatura.

export const ROUNDUP_MULTIPLES = [1, 5, 10] as const;

// Diferença até o próximo múltiplo. 0 quando o valor já é múltiplo exato.
export function computeRoundUp(amount: number, multiple: number): number {
  if (!(amount > 0) || !multiple || multiple <= 0) return 0;
  const rounded = Math.ceil(amount / multiple) * multiple;
  return Math.round((rounded - amount) * 100) / 100;
}

// Evento para o RoundUpToast global avisar de forma transparente.
export const ROUNDUP_EVENT = 'roundup:saved';
export interface RoundUpSavedDetail {
  amount: number;
}

// Aplica o round-up após um GASTO manual. Fire-and-forget por contrato: nunca
// lança (não pode travar o lançamento). No-op se toggle off, sem missão ativa
// ou diff == 0. NÃO chama earnCoins('mission_contribution') — sem +50.
export async function maybeRoundUpExpense(amount: number): Promise<void> {
  try {
    if (!(amount > 0)) return;
    const user = await getCachedUser();
    if (!user) return;

    const { data: profile } = await createClient()
      .from('profiles')
      .select('roundup_enabled, roundup_multiple')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.roundup_enabled) return;

    const multiple = (profile.roundup_multiple as number | null) ?? 1;
    const diff = computeRoundUp(amount, multiple);
    if (diff <= 0) return;

    const mission = await getMission(user.id);
    if (!mission) return;

    // Micro-aporte (is_roundup=true), SEM earnCoins — diferente do aporte manual.
    await addContribution(mission.id, user.id, getMonthKey(new Date()), diff, true);

    // Marcos da meta legítimos (idempotentes, anti-farmados por meta mínima).
    const totalSaved = await getTotalSaved(mission.id);
    const pct =
      mission.targetAmount > 0 ? Math.min(100, (totalSaved / mission.targetAmount) * 100) : 0;
    await claimReachedGoalMilestones(mission.id, pct);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<RoundUpSavedDetail>(ROUNDUP_EVENT, { detail: { amount: diff } })
      );
    }
  } catch {
    // fire-and-forget
  }
}
