import { createClient } from '../supabase/client';
import { cachedFetch, getCachedUser, invalidate, TTL } from '../dataCache';
import { calculateStreak } from '../streak';

// Data LOCAL do usuário (YYYY-MM-DD). Gravamos a data calculada no cliente em
// vez de NOW() do servidor para evitar o off-by-one de fuso (mesma lição do
// fix de timezone em currentMonth). Exportada para o consumo de freeze (3b)
// passar EXATAMENTE o mesmo "hoje" que o streak usa.
export function todayLocalStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// Marca o dia de hoje como ativo. Idempotente: o PK (user_id, active_date) +
// ignoreDuplicates faz a 2ª chamada do dia ser um no-op no banco.
// Best-effort: streak é cosmético, nunca deve quebrar o carregamento da página.
export async function recordActivityToday(): Promise<void> {
  try {
    const user = await getCachedUser();
    if (!user) return;
    const { error } = await createClient()
      .from('user_activity')
      .upsert(
        { user_id: user.id, active_date: todayLocalStr() },
        { onConflict: 'user_id,active_date', ignoreDuplicates: true }
      );
    if (!error) invalidate('activity:streak');
  } catch {
    // silencioso de propósito
  }
}

// Streak de dias seguidos de acesso, derivado do banco (consistente em
// qualquer dispositivo). Reaproveita calculateStreak, que conta dias
// consecutivos a partir de hoje sobre uma lista de { date }.
export async function getAccessStreak(): Promise<number> {
  return cachedFetch('activity:streak', TTL.LIST, async () => {
    const user = await getCachedUser();
    if (!user) return 0;
    const { data, error } = await createClient()
      .from('user_activity')
      .select('active_date')
      .eq('user_id', user.id);
    if (error || !data) return 0;
    return calculateStreak(data.map((r) => ({ date: r.active_date as string })));
  });
}
