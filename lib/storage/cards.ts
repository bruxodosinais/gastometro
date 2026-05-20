import { createClient } from '../supabase/client';
import { cachedFetch, TTL, withCacheInvalidation } from '../dataCache';
import { CreditCard, Expense } from '../types';
import { toExpense } from './expenses';

function toCreditCard(row: Record<string, unknown>): CreditCard {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    nome: row.nome as string,
    limite: row.limite as number,
    diaFechamento: (row.dia_fechamento as number | null) ?? null,
    diaVencimento: (row.dia_vencimento as number | null) ?? null,
    ativo: row.ativo as boolean,
    createdAt: row.created_at as string,
  };
}

export { toCreditCard };

export function calcFaturaPeriod(
  closingDay: number | null,
  year: number,
  month: number
): { start: string; end: string } {
  function toISO(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (!closingDay) {
    const lastDay = new Date(year, month, 0).getDate();
    return { start: toISO(year, month, 1), end: toISO(year, month, lastDay) };
  }
  // end = closingDay of month M, capped to last day of M
  const lastDayM = new Date(year, month, 0).getDate();
  const end = toISO(year, month, Math.min(closingDay, lastDayM));
  // start = day after closingDay in M-1 (JS Date overflow handles month-end edge cases)
  const startDate = new Date(year, month - 2, closingDay + 1);
  const start = toISO(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
  return { start, end };
}

export async function getCreditCards(): Promise<CreditCard[]> {
  return cachedFetch('creditCards', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data ?? []).map(toCreditCard);
  });
}

export async function addCreditCard(
  data: Omit<CreditCard, 'id' | 'userId' | 'createdAt'>
): Promise<CreditCard> {
  return withCacheInvalidation('credit_cards', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { error: insertError } = await supabase
      .from('credit_cards')
      .insert({
        user_id: user.id,
        nome: data.nome,
        limite: data.limite,
        dia_fechamento: data.diaFechamento,
        dia_vencimento: data.diaVencimento,
        ativo: data.ativo,
      });

    if (insertError) throw insertError;

    // Fetch the newly created card separately — avoids RLS edge cases where
    // INSERT RETURNING is blocked even though the row was committed.
    const { data: row, error: selectError } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (selectError) throw selectError;
    return toCreditCard(row);
  });
}

export async function updateCreditCard(
  id: string,
  data: Partial<Omit<CreditCard, 'id' | 'userId' | 'createdAt'>>
): Promise<CreditCard> {
  return withCacheInvalidation('credit_cards', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const patch: Record<string, unknown> = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.limite !== undefined) patch.limite = data.limite;
    if (data.diaFechamento !== undefined) patch.dia_fechamento = data.diaFechamento;
    if (data.diaVencimento !== undefined) patch.dia_vencimento = data.diaVencimento;
    if (data.ativo !== undefined) patch.ativo = data.ativo;

    const { data: row, error } = await supabase
      .from('credit_cards')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return toCreditCard(row);
  });
}

export async function deleteCreditCard(id: string): Promise<void> {
  return withCacheInvalidation('credit_cards', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('credit_cards')
      .update({ ativo: false })
      .eq('id', id)
      .eq('user_id', user.id);
  });
}

export async function getCreditCardFatura(
  cardId: string,
  period: string
): Promise<number> {
  const billingMonth = `${period}-01`;
  const supabase = createClient();
  // Não filtra por is_credit: precisamos tanto das compras (is_credit=true)
  // quanto dos pagamentos da fatura (category='Cartão de Crédito',
  // is_credit=false) — ambos carimbados com o mesmo billing_month.
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, is_credit, category')
    .eq('credit_card_id', cardId)
    .eq('billing_month', billingMonth);

  if (error) return 0;

  let purchases = 0;
  let payments = 0;
  for (const row of data ?? []) {
    const amount = row.amount as number;
    if (row.is_credit === true) purchases += amount;
    else if (row.category === 'Cartão de Crédito') payments += amount;
  }
  // Fatura em aberto = compras − pagamentos, nunca negativa.
  return Math.max(0, purchases - payments);
}

// Mesma conta de getCreditCardFatura, porém SEM ir ao banco: deriva da lista
// de expenses já carregada (que traz creditCardId/isCredit/billingMonth/
// category/amount). A Home buscava expenses 1× e ainda fazia N queries
// getCreditCardFatura — uma por cartão. Agora são 0 queries extras.
export function faturaFromExpenses(
  expenses: Expense[],
  cardId: string,
  period: string
): number {
  const billingMonth = `${period}-01`;
  let purchases = 0;
  let payments = 0;
  for (const e of expenses) {
    if (e.creditCardId !== cardId || e.billingMonth !== billingMonth) continue;
    if (e.isCredit === true) purchases += e.amount;
    else if (e.category === 'Cartão de Crédito') payments += e.amount;
  }
  return Math.max(0, purchases - payments);
}

// Pagamento(s) de fatura registrado(s) para o cartão neste período.
// Mesmo critério de "pagamento" usado em getCreditCardFatura
// (category='Cartão de Crédito', is_credit=false, mesmo billing_month).
// Retorna o total pago e a data do pagamento mais recente, ou null se
// nenhum pagamento foi registrado.
export async function getCreditCardPayment(
  cardId: string,
  period: string
): Promise<{ total: number; lastDate: string } | null> {
  const billingMonth = `${period}-01`;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, date')
    .eq('credit_card_id', cardId)
    .eq('billing_month', billingMonth)
    .eq('category', 'Cartão de Crédito')
    .eq('is_credit', false)
    .order('date', { ascending: false });

  if (error || !data || data.length === 0) return null;

  const total = data.reduce((s, r) => s + (r.amount as number), 0);
  // data ordenado desc por date → primeiro registro é o pagamento mais recente.
  const lastDate = data[0].date as string;
  return { total, lastDate };
}

export async function getExpensesByCard(
  cardId: string,
  period: string
): Promise<Expense[]> {
  const billingMonth = `${period}-01`;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('credit_card_id', cardId)
    .eq('is_credit', true)
    .eq('billing_month', billingMonth)
    .order('date', { ascending: false });

  if (error) return [];
  return (data ?? []).map(toExpense);
}
