import { createClient } from '../supabase/client';
import { invalidate } from '../dataCache';
import { celebrate } from '../notifications/celebrate';

// Conclusão de desafio de IA (M4): marca o desafio como concluído (registro da
// conquista — a RPC complete_challenge segue inserindo o coin_transaction no
// ledger dormente, que ninguém lê). O reforço é só a celebração + o aporte real
// que entra na meta pelo fluxo normal. Nunca lança.
export async function completeChallenge(challengeId: string): Promise<{ ok: boolean }> {
  try {
    const { data, error } = await createClient().rpc('complete_challenge', {
      p_challenge_id: challengeId,
    });
    if (error) {
      console.warn('completeChallenge: falhou:', error.message);
      return { ok: false };
    }
    const res = data as { ok?: boolean } | null;
    if (res?.ok === true) {
      invalidate('mission_challenges');
      celebrate('🤖 Desafio concluído!');
      return { ok: true };
    }
    return { ok: false };
  } catch (e) {
    console.warn('completeChallenge: erro inesperado:', e);
    return { ok: false };
  }
}
