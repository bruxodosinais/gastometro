import { createClient } from '../supabase/client';
import { cachedFetch, invalidate, TTL } from '../dataCache';
import type { CoinTransaction, CoinTransactionType, UserCoins } from './types';

// Evento de janela disparado quando um crédito de moedas é confirmado (> 0).
// É o "barramento" do dopamine loop: o CoinToast global mostra "+N 🪙" e o
// useCoins atualiza o badge, sem cada call site precisar fazer essa fiação.
// Mesmo padrão dos CustomEvents já usados no app (ex.: OPEN_NOTIF_EVENT).
export const COIN_AWARD_EVENT = 'coins:awarded';

export interface CoinAwardDetail {
  amount: number;
  // Mensagem opcional para o toast (ex.: "💰 Aporte registrado!"). Sem label,
  // o CoinToast mostra só "+N 🪙" (comportamento padrão dos ganhos).
  label?: string;
}

// LEITURA do saldo e do extrato de moedas. Os reads cacheiam sob o prefixo
// 'coins:' para que a invalidação em earnCoins (invalidate('coins')) os
// derrube de uma vez.

// Mapeadores snake_case (banco) → camelCase (app). O client Supabase do
// projeto é propositalmente sem tipo Database gerado, então as linhas chegam
// como Record<string, unknown> e são convertidas aqui (mesmo padrão de
// toMonthlyObligation em lib/storage/plans.ts).
function toUserCoins(row: Record<string, unknown>): UserCoins {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    balance: row.balance as number,
    totalEarned: row.total_earned as number,
    updatedAt: row.updated_at as string,
  };
}

function toCoinTransaction(row: Record<string, unknown>): CoinTransaction {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    amount: row.amount as number,
    type: row.type as CoinTransactionType,
    description: (row.description as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// Saldo atual do usuário. Retorna null se ainda não há linha em user_coins
// (usuário nunca ganhou moeda — o trigger só cria a linha na 1ª transação).
export async function getCoinBalance(userId: string): Promise<UserCoins | null> {
  return cachedFetch(`coins:balance:${userId}`, TTL.LIST, async () => {
    const { data } = await createClient()
      .from('user_coins')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    return toUserCoins(data);
  });
}

// Extrato (livro-razão) das últimas `limit` transações, mais recentes primeiro.
export async function getCoinTransactions(
  userId: string,
  limit: number
): Promise<CoinTransaction[]> {
  return cachedFetch(`coins:transactions:${userId}:${limit}`, TTL.LIST, async () => {
    const { data, error } = await createClient()
      .from('coin_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(toCoinTransaction);
  });
}

// Credita moedas pela RPC award_coins (valor FIXO no banco). O app só passa o
// tipo da ação; o usuário/valor são resolvidos no servidor. Retorna a quantia
// creditada (0 se pulada por idempotência ou se houve erro).
//
// FIRE-AND-FORGET por contrato: nunca lança. Se o crédito falhar (offline,
// RPC ausente etc.), a ação do usuário (lançar gasto, marcar pago) NÃO pode
// ser bloqueada — por isso o catch silencioso e o retorno 0.
export async function earnCoins(
  type: CoinTransactionType,
  opts?: { label?: string }
): Promise<number> {
  try {
    const { data, error } = await createClient().rpc('award_coins', { p_type: type });
    if (error) {
      console.warn('earnCoins: award_coins falhou:', error.message);
      return 0;
    }
    const amount = typeof data === 'number' ? data : 0;
    if (amount > 0) {
      // Derruba 'coins:balance:*' e 'coins:transactions:*' do store.
      invalidate('coins');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<CoinAwardDetail>(COIN_AWARD_EVENT, {
            detail: { amount, label: opts?.label },
          })
        );
      }
    }
    return amount;
  } catch (e) {
    console.warn('earnCoins: erro inesperado:', e);
    return 0;
  }
}
