import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll } from './adminFetchAll';

// De qual plataforma cada usuário veio, para o painel /admin.
//
// Três fontes, da mais antiga para a mais nova:
//   · device_tokens.platform  → ativou push nativo num aparelho iOS/Android.
//   · subscriptions.store     → assinou o Pro pela App Store / Play Store.
//   · onboarding_events       → o app 1.4+ manda a plataforma em cada evento
//                                do funil. É a ÚNICA que pega quem recusou push
//                                e não assinou.
// Contas anteriores à 1.4 sem push e sem assinatura continuam sem registro:
// esse dado nunca foi gravado e não dá para recuperar.
//
// O funil costura pré e pós-cadastro pelo `anon_id` (do aparelho): os eventos
// de antes da conta têm user_id null, os de depois trazem o user_id. Qualquer
// evento com user_id liga aquele anon_id à conta, e aí todos os eventos daquele
// aparelho passam a contar para ela.

export type Platform = 'ios' | 'android' | 'web';

export interface UserPlatform {
  /** Onde a pessoa começou: plataforma do 1º evento do funil ligado à conta. */
  signup: Platform | null;
  /** Usou o app nativo iOS (push, loja ou evento do funil). */
  ios: boolean;
  /** Usou o app nativo Android (push, loja ou evento do funil). */
  android: boolean;
}

const isPlatform = (p: unknown): p is Platform => p === 'ios' || p === 'android' || p === 'web';

type EventRow = { anon_id: string; user_id: string | null; platform: string | null; created_at: string };

export async function loadUserPlatforms(admin: SupabaseClient): Promise<Map<string, UserPlatform>> {
  const [events, { data: tokens }, { data: subs }] = await Promise.all([
    fetchAll<EventRow>((from, to) => admin
      .from('onboarding_events')
      .select('anon_id, user_id, platform, created_at')
      .order('id', { ascending: true })
      .range(from, to)),
    admin.from('device_tokens').select('user_id, platform'),
    admin.from('subscriptions').select('user_id, store'),
  ]);

  const result = new Map<string, UserPlatform>();
  const entry = (userId: string): UserPlatform => {
    let e = result.get(userId);
    if (!e) {
      e = { signup: null, ios: false, android: false };
      result.set(userId, e);
    }
    return e;
  };
  const markNative = (userId: string, p: string | null | undefined) => {
    if (p === 'ios') entry(userId).ios = true;
    else if (p === 'android') entry(userId).android = true;
  };

  for (const t of tokens ?? []) markNative(t.user_id, t.platform);
  for (const s of subs ?? []) {
    if (s.store === 'app_store') markNative(s.user_id, 'ios');
    else if (s.store === 'play_store') markNative(s.user_id, 'android');
  }

  // anon_id → conta. Um aparelho pode, em tese, ter criado mais de uma conta;
  // fica a última vista, que é a que o aparelho está usando.
  const userByAnon = new Map<string, string>();
  for (const e of events) if (e.user_id) userByAnon.set(e.anon_id, e.user_id);

  // Primeiro evento de cada conta = onde ela começou. Compara por instante.
  const firstTs = new Map<string, number>();
  for (const e of events) {
    const userId = e.user_id ?? userByAnon.get(e.anon_id);
    if (!userId || !isPlatform(e.platform)) continue;
    markNative(userId, e.platform);
    const ts = new Date(e.created_at).getTime();
    const prev = firstTs.get(userId);
    if (prev === undefined || ts < prev) {
      firstTs.set(userId, ts);
      entry(userId).signup = e.platform;
    }
  }

  return result;
}

export const EMPTY_PLATFORM: UserPlatform = { signup: null, ios: false, android: false };
