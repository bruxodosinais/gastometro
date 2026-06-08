import { createClient } from '../supabase/client';
import { cachedFetch, invalidate, TTL } from '../dataCache';
import { COIN_AWARD_EVENT, type CoinAwardDetail } from './coins';

// Streak Freeze (Pilar 2 · Item 3a): ganhar 1/semana e comprar com moedas.
// Mesmo princípio de coins.ts — o BANCO decide regra/valor; aqui só disparamos
// a ação e propagamos o feedback. NÃO mexe no cálculo de streak (isso é o 3b).

export const FREEZE_COST = 50;

// Evento de janela para o contador 🧊 se atualizar (espelha COIN_AWARD_EVENT).
export const FREEZE_CHANGED_EVENT = 'freezes:changed';
export interface FreezeChangedDetail {
  freezes: number;
}

// Evento disparado quando um freeze foi CONSUMIDO para salvar a ofensiva (3b).
// O StreakFreezeToast global escuta e mostra a mensagem. Só dispara consumed > 0.
export const FREEZE_SAVED_EVENT = 'freezes:saved';
export interface FreezeSavedDetail {
  consumed: number;
}

export interface ConsumeFreezeResult {
  consumed: number;
  newFreezes?: number;
  streakSaved: boolean;
}

export interface BuyFreezeResult {
  ok: boolean;
  reason?: 'max' | 'coins';
  newFreezes?: number;
  newBalance?: number;
}

// Quantidade de freezes guardados (profiles.streak_freezes). Cache 'freezes:'
// para a invalidação derrubar de uma vez. profiles tem chave `id`.
export async function getStreakFreezes(userId: string): Promise<number> {
  return cachedFetch(`freezes:${userId}`, TTL.LIST, async () => {
    const { data } = await createClient()
      .from('profiles')
      .select('streak_freezes')
      .eq('id', userId)
      .maybeSingle();
    return (data?.streak_freezes as number | null) ?? 0;
  });
}

function dispatchFreezeChanged(freezes: number): void {
  invalidate('freezes');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<FreezeChangedDetail>(FREEZE_CHANGED_EVENT, { detail: { freezes } })
    );
  }
}

// Consome freeze(s) para pontear dias perdidos e preservar a ofensiva de acesso
// (3b). `pToday` é a MESMA string de data local que o recordActivityToday grava
// (fuso do dispositivo). A RPC só consome se cobrir o gap inteiro e é idempotente
// por dia. Em consumed > 0: invalida o streak (relido com os dias ponteados) e o
// contador 🧊, e dispara o toast "salvou sua ofensiva". Nunca lança.
export async function consumeFreezeForGap(pToday: string): Promise<ConsumeFreezeResult> {
  try {
    const { data, error } = await createClient().rpc('consume_freeze_for_gap', { p_today: pToday });
    if (error) {
      console.warn('consumeFreezeForGap: falhou:', error.message);
      return { consumed: 0, streakSaved: false };
    }
    const res = data as
      | { consumed?: number; new_freezes?: number; streak_saved?: boolean }
      | null;
    const consumed = res?.consumed ?? 0;
    if (consumed > 0) {
      // O streak é relido com os dias ponteados; o contador 🧊 caiu.
      invalidate('activity:streak');
      invalidate('freezes');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<FreezeChangedDetail>(FREEZE_CHANGED_EVENT, {
            detail: { freezes: res?.new_freezes ?? 0 },
          })
        );
        window.dispatchEvent(
          new CustomEvent<FreezeSavedDetail>(FREEZE_SAVED_EVENT, { detail: { consumed } })
        );
      }
    }
    return { consumed, newFreezes: res?.new_freezes, streakSaved: res?.streak_saved ?? false };
  } catch (e) {
    console.warn('consumeFreezeForGap: erro inesperado:', e);
    return { consumed: 0, streakSaved: false };
  }
}

// Ganho semanal automático. FIRE-AND-FORGET: nunca lança. A idempotência por
// SEMANA ISO está na RPC — chamar todo load é seguro (no-op fora da 1ª vez).
export async function grantWeeklyFreeze(): Promise<void> {
  try {
    const { data, error } = await createClient().rpc('grant_weekly_freeze');
    if (error) {
      console.warn('grantWeeklyFreeze: falhou:', error.message);
      return;
    }
    const res = data as { granted?: boolean; new_freezes?: number } | null;
    if (res?.granted === true) dispatchFreezeChanged(res.new_freezes ?? 0);
  } catch (e) {
    console.warn('grantWeeklyFreeze: erro inesperado:', e);
  }
}

// Compra 1 freeze por 50 🪙. Retorna o resultado para a UI exibir a mensagem
// certa (sucesso / 'max' / 'coins'). Em sucesso: atualiza o contador 🧊 e faz o
// badge de moeda cair 50 (COIN_AWARD_EVENT com delta negativo — o CoinToast
// ignora amount <= 0, então não aparece "+"). Não lança.
export async function buyStreakFreeze(): Promise<BuyFreezeResult> {
  try {
    const { data, error } = await createClient().rpc('buy_streak_freeze');
    if (error) {
      console.warn('buyStreakFreeze: falhou:', error.message);
      return { ok: false };
    }
    const res = data as {
      ok?: boolean;
      reason?: 'max' | 'coins';
      new_freezes?: number;
      new_balance?: number;
    } | null;

    if (res?.ok === true) {
      const newFreezes = res.new_freezes ?? 0;
      dispatchFreezeChanged(newFreezes);
      invalidate('coins');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<CoinAwardDetail>(COIN_AWARD_EVENT, { detail: { amount: -FREEZE_COST } })
        );
      }
      return { ok: true, newFreezes, newBalance: res.new_balance };
    }
    return { ok: false, reason: res?.reason };
  } catch (e) {
    console.warn('buyStreakFreeze: erro inesperado:', e);
    return { ok: false };
  }
}
