import { createClient } from '../supabase/client';
import { cachedFetch, TTL, withCacheInvalidation } from '../dataCache';
import { Budget, ExpenseCategory } from '../types';

function toBudget(row: Record<string, unknown>): Budget {
  return {
    id: row.id as string,
    category: row.category as ExpenseCategory,
    amount: row.amount as number,
  };
}

export { toBudget };

export async function getBudgets(): Promise<Budget[]> {
  return cachedFetch('budgets', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from('budgets').select('*');
    if (error) return [];
    return (data ?? []).map(toBudget);
  });
}

export async function upsertBudget(category: ExpenseCategory, amount: number): Promise<void> {
  return withCacheInvalidation('budgets', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { error } = await supabase
      .from('budgets')
      .upsert({ user_id: user.id, category, amount }, { onConflict: 'user_id,category' });

    if (error) throw error;
  });
}

export async function deleteBudget(category: ExpenseCategory): Promise<void> {
  return withCacheInvalidation('budgets', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('budgets').delete().eq('user_id', user.id).eq('category', category);
  });
}
