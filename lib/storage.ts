import { createClient } from './supabase/client';
import { Asset, AssetType, Budget, Category, EntryType, Expense, ExpenseCategory, Goal, GoalContribution, GoalTerm, GoalType, Liability, MonthlyObligation, MonthlyPlan, RecurringExpense } from './types';

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
    dueDay: (row.due_day as number | null) ?? undefined,
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
      due_day: data.dueDay ?? data.dayOfMonth,
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

// ─── Metas Financeiras ────────────────────────────────────────────────────────

function toGoal(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as GoalType,
    targetAmount: row.target_amount as number,
    currentAmount: row.current_amount as number,
    deadline: (row.deadline as string | null) ?? undefined,
    color: (row.color as string) ?? 'violet',
    status: row.status as 'active' | 'completed',
    term: (row.term as GoalTerm | null) ?? undefined,
    emoji: (row.emoji as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function getGoals(): Promise<Goal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map(toGoal);
}

export async function createGoal(data: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data: row, error } = await supabase
    .from('goals')
    .insert({
      user_id: user.id,
      name: data.name,
      type: data.type,
      target_amount: data.targetAmount,
      current_amount: data.currentAmount,
      deadline: data.deadline ?? null,
      color: data.color,
      status: data.status,
      term: data.term ?? null,
      emoji: data.emoji ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error('createGoal:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw new Error(error.message || 'Erro ao criar meta');
  }
  return toGoal(row);
}

export async function updateGoal(id: string, data: Partial<Omit<Goal, 'id' | 'createdAt'>>): Promise<Goal> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.type !== undefined) patch.type = data.type;
  if (data.targetAmount !== undefined) patch.target_amount = data.targetAmount;
  if (data.currentAmount !== undefined) patch.current_amount = data.currentAmount;
  if ('deadline' in data) patch.deadline = data.deadline ?? null;
  if (data.color !== undefined) patch.color = data.color;
  if (data.status !== undefined) patch.status = data.status;
  if ('term' in data) patch.term = data.term ?? null;
  if ('emoji' in data) patch.emoji = data.emoji ?? null;

  const { data: row, error } = await supabase
    .from('goals')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) {
    console.error('updateGoal:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw new Error(error.message || 'Erro ao atualizar meta');
  }
  return toGoal(row);
}

export async function deleteGoal(id: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id);
}

function toContribution(row: Record<string, unknown>): GoalContribution {
  return {
    id: row.id as string,
    goalId: row.goal_id as string,
    amount: row.amount as number,
    note: (row.note as string | null) ?? undefined,
    date: row.date as string,
    createdAt: row.created_at as string,
  };
}

export async function getAllGoalContributions(): Promise<GoalContribution[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('goal_contributions')
    .select('*')
    .order('date', { ascending: false });
  if (error) return [];
  return (data ?? []).map(toContribution);
}

// ─── Patrimônio ───────────────────────────────────────────────────────────────

function toAsset(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as AssetType,
    value: row.value as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAssets(): Promise<Asset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map(toAsset);
}

export async function createAsset(data: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  const { data: row, error } = await supabase
    .from('assets')
    .insert({ user_id: user.id, name: data.name, type: data.type, value: data.value })
    .select()
    .single();
  if (error) throw error;
  return toAsset(row);
}

export async function updateAsset(id: string, data: Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Asset> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  const { data: row, error } = await supabase
    .from('assets')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) throw error;
  return toAsset(row);
}

export async function deleteAsset(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('assets').delete().eq('id', id).eq('user_id', user.id);
}

function toLiability(row: Record<string, unknown>): Liability {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    value: row.value as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getLiabilities(): Promise<Liability[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map(toLiability);
}

export async function createLiability(data: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>): Promise<Liability> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  const { data: row, error } = await supabase
    .from('liabilities')
    .insert({ user_id: user.id, name: data.name, type: data.type, value: data.value })
    .select()
    .single();
  if (error) throw error;
  return toLiability(row);
}

export async function updateLiability(id: string, data: Partial<Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Liability> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  const { data: row, error } = await supabase
    .from('liabilities')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) throw error;
  return toLiability(row);
}

export async function deleteLiability(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('liabilities').delete().eq('id', id).eq('user_id', user.id);
}

// ─── Obrigações Mensais ───────────────────────────────────────────────────────

function toMonthlyObligation(row: Record<string, unknown>): MonthlyObligation {
  return {
    id: row.id as string,
    recurringExpenseId: row.recurring_expense_id as string,
    month: row.month as string,
    amount: row.amount as number,
    description: row.description as string,
    category: row.category as Category,
    dueDay: row.due_day as number,
    status: row.status as 'pending' | 'paid',
    paidAt: (row.paid_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function getMonthlyObligations(month: string): Promise<MonthlyObligation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('monthly_obligations')
    .select('*')
    .eq('month', month)
    .order('due_day', { ascending: true });
  if (error) return [];
  return (data ?? []).map(toMonthlyObligation);
}

// Gera as obrigações do mês caso ainda não existam. Protegido por sessionStorage
// para não re-executar desnecessariamente dentro da mesma sessão.
export async function checkAndGenerateObligations(): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const sessionKey = `obligations_generated_${currentMonth}`;

  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { count, error: countError } = await supabase
    .from('monthly_obligations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('month', currentMonth);

  // Se a tabela não existir ou houver erro, não marcar sessionStorage
  if (countError) return;

  if ((count ?? 0) > 0) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  const { data: recurring } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .eq('type', 'expense');

  if (!recurring?.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  const obligations = recurring.map((rec) => ({
    user_id: user.id,
    recurring_expense_id: rec.id,
    month: currentMonth,
    amount: rec.amount,
    description: rec.description,
    category: rec.category,
    due_day: (rec.due_day as number | null) ?? rec.day_of_month,
    status: 'pending',
  }));

  const { error: insertError } = await supabase.from('monthly_obligations').insert(obligations);
  if (!insertError && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(sessionKey, '1');
  }
}

export async function markObligationAsPaid(
  obligationId: string,
  obligation: MonthlyObligation
): Promise<{ obligation: MonthlyObligation; expense: Expense }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const [year, month] = obligation.month.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(obligation.dueDay, lastDay);
  const date = `${obligation.month}-${String(day).padStart(2, '0')}`;

  const { data: obligationRow, error: obErr } = await supabase
    .from('monthly_obligations')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', obligationId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (obErr) throw obErr;

  const { data: expenseRow, error: expErr } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      type: 'expense',
      amount: obligation.amount,
      description: obligation.description,
      category: obligation.category,
      date,
      recurring_expense_id: obligation.recurringExpenseId,
    })
    .select()
    .single();

  if (expErr) throw expErr;

  return {
    obligation: toMonthlyObligation(obligationRow),
    expense: toExpense(expenseRow),
  };
}

// Cria obrigação imediata para um recorrente recém-cadastrado no mês atual.
// Usado após addRecurringExpense para evitar depender do checkAndGenerateObligations.
export async function addObligationForNewRecurring(
  rec: RecurringExpense
): Promise<MonthlyObligation | null> {
  if (rec.type !== 'expense' || !rec.active) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase
    .from('monthly_obligations')
    .insert({
      user_id: user.id,
      recurring_expense_id: rec.id,
      month: currentMonth,
      amount: rec.amount,
      description: rec.description,
      category: rec.category,
      due_day: rec.dueDay ?? rec.dayOfMonth,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return null;
  return toMonthlyObligation(data);
}

export async function addGoalContribution(
  goalId: string,
  amount: number,
  note?: string,
  date?: string
): Promise<Goal> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  await supabase.from('goal_contributions').insert({
    user_id: user.id,
    goal_id: goalId,
    amount,
    note: note ?? null,
    date: date ?? new Date().toISOString().slice(0, 10),
  });

  const { data: current } = await supabase
    .from('goals')
    .select('current_amount, target_amount')
    .eq('id', goalId)
    .single();

  const newAmount = (current?.current_amount ?? 0) + amount;
  const newStatus = newAmount >= (current?.target_amount ?? Infinity) ? 'completed' : 'active';

  const { data: row, error } = await supabase
    .from('goals')
    .update({ current_amount: newAmount, status: newStatus })
    .eq('id', goalId)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) {
    console.error('addGoalContribution:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw new Error(error.message || 'Erro ao registrar aporte');
  }
  return toGoal(row);
}
