import { createClient } from '../supabase/client';
import { invalidate } from '../dataCache';
import { COIN_AWARD_EVENT, type CoinAwardDetail } from './coins';

// Conclusão de desafio de IA (M4): marca concluído + credita +100 (ai_challenge).
// O APORTE em si é o fluxo normal (addContribution +50 via M1) — esta função só
// fecha o desafio e dá o +100. A celebração reusa o COIN_AWARD_EVENT: o CoinToast
// empilha o pop "🤖 Desafio concluído! +100" logo abaixo do pop "💰 Aporte +50"
// no MESMO container (sem sobreposição, sem 3º toast). Nunca lança.
export async function completeChallenge(
  challengeId: string
): Promise<{ ok: boolean; coins?: number }> {
  try {
    const { data, error } = await createClient().rpc('complete_challenge', {
      p_challenge_id: challengeId,
    });
    if (error) {
      console.warn('completeChallenge: falhou:', error.message);
      return { ok: false };
    }
    const res = data as { ok?: boolean; coins?: number } | null;
    if (res?.ok === true) {
      invalidate('coins');
      invalidate('mission_challenges');
      const coins = res.coins ?? 0;
      if (coins > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<CoinAwardDetail>(COIN_AWARD_EVENT, {
            detail: { amount: coins, label: '🤖 Desafio concluído!' },
          })
        );
      }
      return { ok: true, coins };
    }
    return { ok: false };
  } catch (e) {
    console.warn('completeChallenge: erro inesperado:', e);
    return { ok: false };
  }
}
