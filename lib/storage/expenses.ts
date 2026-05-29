import { createClient } from '../supabase/client';
import { cachedFetch, TTL, withCacheInvalidation } from '../dataCache';
import { EntryType, Expense } from '../types';

export function toExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    type: ((row.type as string) ?? 'expense') as EntryType,
    amount: row.amount as number,
    description: row.description as string,
    category: row.category as string,
    date: row.date as string,
    createdAt: row.created_at as string,
    recurringExpenseId: (row.recurring_expense_id as string | null) ?? undefined,
    creditCardId: (row.credit_card_id as string | null) ?? undefined,
    isCredit: (row.is_credit as boolean | null) ?? undefined,
    billingMonth: (row.billing_month as string | null) ?? undefined,
  };
}

export async function getExpenses(): Promise<Expense[]> {
  return cachedFetch('expenses', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) return [];
    return (data ?? []).map(toExpense);
  });
}

export async function addExpense(
  data: Omit<Expense, 'id' | 'createdAt'>,
  recurringExpenseId?: string
): Promise<Expense> {
  return withCacheInvalidation('expenses', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: row, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        type: data.type,
        amount: data.amount,
        description: data.description,
        category: data.category,
        date: data.date,
        ...(recurringExpenseId ? { recurring_expense_id: recurringExpenseId } : {}),
        is_credit: data.isCredit ?? false,
        credit_card_id: data.creditCardId ?? null,
        billing_month: data.billingMonth ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('PLAN_LIMIT_EXCEEDED')) {
        throw new Error(
          'Você atingiu o limite de 20 lançamentos no plano gratuito. Faça upgrade para continuar.',
        );
      }
      throw error;
    }
    return toExpense(row);
  });
}

// Cria N lançamentos mensais consecutivos com "(i/N)" na descrição
export async function addExpenseInstallments(
  base: Omit<Expense, 'id' | 'createdAt'>,
  installments: number
): Promise<Expense[]> {
  return withCacheInvalidation('expenses', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const baseDate = new Date(`${base.date}T12:00:00`);
    const baseDay = baseDate.getDate();

    const rows = Array.from({ length: installments }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(1);
      d.setMonth(d.getMonth() + i);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(baseDay, lastDay));
      return {
        user_id: user.id,
        type: base.type,
        amount: base.amount,
        description: `${base.description} (${i + 1}/${installments})`,
        category: base.category,
        date: d.toISOString().slice(0, 10),
      };
    });

    const { data, error } = await supabase.from('expenses').insert(rows).select();
    if (error) {
      if (error.message?.includes('PLAN_LIMIT_EXCEEDED')) {
        throw new Error(
          'Você atingiu o limite de 20 lançamentos no plano gratuito. Faça upgrade para continuar.',
        );
      }
      throw error;
    }
    return (data ?? []).map(toExpense);
  });
}

export async function updateExpense(
  id: string,
  data: Omit<Expense, 'id' | 'createdAt'>
): Promise<Expense> {
  return withCacheInvalidation('expenses', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const payload = {
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category,
      date: data.date,
      credit_card_id: data.creditCardId ?? null,
      is_credit: data.isCredit ?? false,
      billing_month: data.billingMonth ?? null,
    };

    // UPDATE sem .select().single(): o .single() encadeado num UPDATE quebra
    // com "Cannot coerce the result to a single JSON object" em algumas versões
    // do supabase-js. Atualizamos e buscamos o registro separadamente — 100%
    // compatível com qualquer versão. Filtro duplo id + user_id mantém o WHERE
    // correto e respeita a RLS.
    const { error: updateError } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      // PostgrestError não é instância de Error — sem este tratamento o modal
      // só conseguia exibir a mensagem genérica "Erro ao salvar".
      console.error('updateExpense (update):', {
        id,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      throw new Error(updateError.message || 'Erro ao salvar o lançamento');
    }

    const { data: row, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      console.error('updateExpense (refetch):', {
        id,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
        code: fetchError.code,
      });
      throw new Error(fetchError.message || 'Erro ao recarregar o lançamento');
    }
    if (!row) {
      throw new Error('Lançamento não encontrado ou sem permissão para editar');
    }
    return toExpense(row);
  });
}

export async function deleteExpense(id: string): Promise<void> {
  return withCacheInvalidation('expenses', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    await supabase.from('expenses').delete().eq('id', id).eq('user_id', user.id);
  });
}
