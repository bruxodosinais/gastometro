import { createClient } from './supabase/client';
import { Budget, Category, EntryType, Expense, ExpenseCategory, MonthlyPlan, RecurringExpense } from './types';

function toExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    type: ((row.type as string) ?? 'expense') as EntryType,
    amount: row.amount as number,
    description: row.description as string,
    category: row.category as Category,
    date: row.date as string,
    createdAt: row.created_at as string,
    recurringExpenseId: (row.recurring_expense_id as string | null) ?? undefined,
  };
}

export async function getExpenses(): Promise<Expense[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) return [];
  return (data ?? []).map(toExpense);
}

export async function addExpense(
  data: Omit<Expense, 'id' | 'createdAt'>,
  recurringExpenseId?: string
): Promise<Expense> {
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
    })
    .select()
    .single();

  if (error) throw error;
  return toExpense(row);
}

// Cria N lançamentos mensais consecutivos com "(i/N)" na descrição
export async function addExpenseInstallments(
  base: Omit<Expense, 'id' | 'createdAt'>,
  installments: number
): Promise<Expense[]> {
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
  if (error) throw error;
  return (data ?? []).map(toExpense);
}

export async function updateExpense(
  id: string,
  data: Omit<Expense, 'id' | 'createdAt'>
): Promise<Expense> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: row, error } = await supabase
    .from('expenses')
    .update({
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category,
      date: data.date,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return toExpense(row);
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('expenses').delete().eq('id', id);
}

// ─── Recorrentes ─────────────────────────────────────────────────────────────

function toRecurring(row: Record<string, unknown>): RecurringExpense {
  return {
    id: row.id as string,
    description: row.description as string,
    amount: row.amount as number,
    category: row.category as Category,
    type: (row.type as string) as EntryType,
    dayOfMonth: row.day_of_month as number,
    active: row.active as boolean,
    createdAt: row.created_at as string,
  };
}

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map(toRecurring);
}

export async function addRecurringExpense(
  data: Omit<RecurringExpense, 'id' | 'createdAt'>
): Promise<RecurringExpense> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: row, error } = await supabase
    .from('recurring_expenses')
    .insert({
      user_id: user.id,
      description: data.description,
      amount: data.amount,
      category: data.category,
      type: data.type,
      day_of_month: data.dayOfMonth,
      active: data.active,
    })
    .select()
    .single();

  if (error) throw error;
  return toRecurring(row);
}

export async function toggleRecurringExpense(id: string, active: boolean): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('recurring_expenses')
    .update({ active })
    .eq('id', id)
    .eq('user_id', user.id);
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('recurring_expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
}

// IDs de recorrentes já lançados no mês atual
export async function getLaunchedRecurringIds(): Promise<Set<string>> {
  const supabase = createClient();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data } = await supabase
    .from('expenses')
    .select('recurring_expense_id')
    .not('recurring_expense_id', 'is', null)
    .gte('date', `${currentMonth}-01`)
    .lte('date', `${currentMonth}-31`);
  return new Set(
    (data ?? []).map((e) => e.recurring_expense_id as string).filter(Boolean)
  );
}

// Auto-lança recorrentes do mês atual que ainda não foram lançados
// Protegido por sessionStorage: roda no máximo uma vez por dia por sessão
export async function checkAndLaunchRecurring(): Promise<void> {
  const todayKey = `recurring_checked_${new Date().toISOString().slice(0, 10)}`;
  if (typeof sessionStorage !== 'undefined') {
    if (sessionStorage.getItem(todayKey)) return;
    sessionStorage.setItem(todayKey, '1');
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date();
  const todayDay = now.getDate();
  const currentMonth = now.toISOString().slice(0, 7);

  const [{ data: recurring }, launchedIds] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true),
    getLaunchedRecurringIds(),
  ]);

  if (!recurring?.length) return;

  for (const rec of recurring) {
    // Só lança se o dia já chegou e ainda não foi lançado este mês
    if (rec.day_of_month > todayDay) continue;
    if (launchedIds.has(rec.id)) continue;

    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = Math.min(rec.day_of_month, lastDay);
    const date = `${currentMonth}-${String(day).padStart(2, '0')}`;

    await supabase.from('expenses').insert({
      user_id: user.id,
      type: rec.type,
      amount: rec.amount,
      description: rec.description,
      category: rec.category,
      date,
      recurring_expense_id: rec.id,
    });
  }
}

// ─── Planejamento Mensal ──────────────────────────────────────────────────────

export async function getMonthlyPlan(month: string): Promise<MonthlyPlan | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('monthly_plans')
    .select('*')
    .eq('month', month)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    month: data.month,
    expectedIncome: data.expected_income,
    savingsGoal: data.savings_goal,
  };
}

export async function upsertMonthlyPlan(
  month: string,
  expectedIncome: number,
  savingsGoal: number
): Promise<MonthlyPlan> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('monthly_plans')
    .upsert(
      { user_id: user.id, month, expected_income: expectedIncome, savings_goal: savingsGoal },
      { onConflict: 'user_id,month' }
    )
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    month: data.month,
    expectedIncome: data.expected_income,
    savingsGoal: data.savings_goal,
  };
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

function toBudget(row: Record<string, unknown>): Budget {
  return {
    id: row.id as string,
    category: row.category as ExpenseCategory,
    amount: row.amount as number,
  };
}

export async function getBudgets(): Promise<Budget[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('budgets').select('*');
  if (error) return [];
  return (data ?? []).map(toBudget);
}

export async function upsertBudget(category: ExpenseCategory, amount: number): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('budgets')
    .upsert({ user_id: user.id, category, amount }, { onConflict: 'user_id,category' });

  if (error) throw error;
}

export async function deleteBudget(category: ExpenseCategory): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('budgets').delete().eq('user_id', user.id).eq('category', category);
}
