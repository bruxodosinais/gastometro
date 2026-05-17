import { createClient } from './supabase/client';
import { cachedFetch, getCachedUser, invalidate, TTL } from './dataCache';
import { Asset, AssetType, Budget, Category, CreditCard, EntryType, Expense, ExpenseCategory, Goal, GoalContribution, GoalTerm, GoalType, Liability, MonthlyObligation, MonthlyPlan, RecurringExpense } from './types';

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

  if (error) throw error;
  invalidate('expenses');
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
  invalidate('expenses');
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
  invalidate('expenses');
  return toExpense(row);
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('expenses').delete().eq('id', id);
  invalidate('expenses');
}

// ─── Recorrentes ─────────────────────────────────────────────────────────────

function toRecurring(row: Record<string, unknown>): RecurringExpense {
  // day_of_month e due_day podem ser NULL no banco (itens antigos criados antes
  // dessas colunas existirem). Manter como undefined — NUNCA aplicar fallback
  // para 1 ou qualquer valor padrão aqui.
  const rawDay = row.day_of_month;
  const dayOfMonth =
    typeof rawDay === 'number' && rawDay >= 1 && rawDay <= 31 ? rawDay : undefined;
  const rawDue = row.due_day;
  const dueDay =
    typeof rawDue === 'number' && rawDue >= 1 && rawDue <= 31 ? rawDue : undefined;
  return {
    id: row.id as string,
    description: row.description as string,
    amount: row.amount as number,
    category: row.category as Category,
    type: (row.type as string) as EntryType,
    dayOfMonth,
    dueDay,
    active: row.active as boolean,
    isVariable: (row.is_variable as boolean | null) ?? false,
    isCredit: (row.is_credit as boolean | null) ?? undefined,
    creditCardId: (row.credit_card_id as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  return cachedFetch('recurring', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []).map(toRecurring);
  });
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
      // day_of_month e due_day são salvos de forma independente. due_day NUNCA
      // herda de day_of_month — campos com semânticas distintas (lançamento vs
      // vencimento).
      day_of_month: data.dayOfMonth ?? null,
      due_day: data.dueDay ?? null,
      active: data.active,
      is_variable: data.isVariable ?? false,
      is_credit: data.isCredit ?? false,
      credit_card_id: data.creditCardId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  invalidate('recurring');
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
  invalidate('recurring');
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
  invalidate('recurring');
}

export type UpdateRecurringPayload = {
  description?: string;
  amount?: number;
  category?: Category;
  type?: EntryType;
  // null limpa o campo no banco; undefined deixa intocado.
  dayOfMonth?: number | null;
  dueDay?: number | null;
  isVariable?: boolean;
  active?: boolean;
  isCredit?: boolean;
  creditCardId?: string | null;
};

export async function updateRecurringExpense(
  id: string,
  data: UpdateRecurringPayload
): Promise<RecurringExpense> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const patch: Record<string, unknown> = {};
  if (data.description !== undefined) patch.description = data.description;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.category !== undefined) patch.category = data.category;
  if (data.type !== undefined) patch.type = data.type;
  if (data.dayOfMonth !== undefined) patch.day_of_month = data.dayOfMonth;
  if (data.dueDay !== undefined) patch.due_day = data.dueDay;
  if (data.isVariable !== undefined) patch.is_variable = data.isVariable;
  if (data.active !== undefined) patch.active = data.active;

  const { data: row, error } = await supabase
    .from('recurring_expenses')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  invalidate('recurring');
  return toRecurring(row);
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
    // Sem day_of_month, não há gatilho de lançamento automático — pula.
    if (
      typeof rec.day_of_month !== 'number' ||
      rec.day_of_month < 1 ||
      rec.day_of_month > 31
    ) continue;
    // Só lança se o dia já chegou e ainda não foi lançado este mês
    if (rec.day_of_month > todayDay) continue;
    if (launchedIds.has(rec.id)) continue;
    // Despesas variáveis exigem valor real informado pelo usuário no momento do pagamento
    if (rec.is_variable) continue;

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
      is_credit: rec.is_credit ?? false,
      credit_card_id: rec.credit_card_id ?? null,
    });
  }
}

// ─── Planejamento Mensal ──────────────────────────────────────────────────────

export async function getMonthlyPlan(month: string): Promise<MonthlyPlan | null> {
  return cachedFetch(`monthlyPlan:${month}`, TTL.LIST, async () => {
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
  });
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
  invalidate('monthlyPlan');
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
  return cachedFetch('budgets', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from('budgets').select('*');
    if (error) return [];
    return (data ?? []).map(toBudget);
  });
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
  invalidate('budgets');
}

export async function deleteBudget(category: ExpenseCategory): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('budgets').delete().eq('user_id', user.id).eq('category', category);
  invalidate('budgets');
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
  return cachedFetch('goalContributions', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('goal_contributions')
      .select('*')
      .order('date', { ascending: false });
    if (error) return [];
    return (data ?? []).map(toContribution);
  });
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
  const rawDue = row.due_day;
  return {
    id: row.id as string,
    recurringExpenseId: row.recurring_expense_id as string,
    month: row.month as string,
    amount: row.amount as number,
    description: row.description as string,
    category: row.category as Category,
    dueDay:
      typeof rawDue === 'number' && rawDue >= 1 && rawDue <= 31 ? rawDue : undefined,
    status: row.status as 'pending' | 'paid',
    paidAt: (row.paid_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function getMonthlyObligations(month: string): Promise<MonthlyObligation[]> {
  return cachedFetch(`obligations:${month}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('monthly_obligations')
      .select('*')
      .eq('month', month)
      .order('due_day', { ascending: true });
    if (error) return [];
    return (data ?? []).map(toMonthlyObligation);
  });
}

// Gera as obrigações do mês caso ainda não existam. Protegido por sessionStorage
// para não re-executar desnecessariamente dentro da mesma sessão.
//
// Dedupe em voo: RecurringCheck, a Home, a Sidebar e a TopbarDesktop chamam
// isto quase ao mesmo tempo no primeiro load. O sessionStorage só é gravado
// DEPOIS da query, então sem este guard os 4 corriam concorrentes (race) e
// cada um disparava getUser + count + recurring. Agora compartilham 1 execução.
let obligationsInflight: Promise<void> | null = null;
export function checkAndGenerateObligations(): Promise<void> {
  if (obligationsInflight) return obligationsInflight;
  obligationsInflight = runCheckAndGenerateObligations().finally(() => {
    obligationsInflight = null;
  });
  return obligationsInflight;
}

async function runCheckAndGenerateObligations(): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const sessionKey = `obligations_generated_${currentMonth}`;

  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) return;

  const supabase = createClient();
  const user = await getCachedUser();
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

  // Reusa o getRecurringExpenses cacheado — a Home, Sidebar e Topbar buscam
  // recorrentes no mesmo load; sem isto era +1 query idêntica aqui.
  const recurring = (await getRecurringExpenses()).filter(
    (r) => r.active && r.type === 'expense'
  );

  if (!recurring.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  const obligations = recurring.map((rec) => {
    // Obrigação herda APENAS due_day do recorrente. due_day e day_of_month têm
    // significados distintos — não fazer fallback cruzado. Quando ambos são
    // null, a obrigação fica sem prazo (due_day null) e nenhum badge de
    // atraso/vencimento é mostrado nas telas. toRecurring já valida o range
    // 1..31 (dueDay vira undefined fora dele).
    const due = typeof rec.dueDay === 'number' ? rec.dueDay : null;
    return {
      user_id: user.id,
      recurring_expense_id: rec.id,
      month: currentMonth,
      amount: rec.amount,
      description: rec.description,
      category: rec.category,
      due_day: due,
      status: 'pending',
    };
  });

  const { error: insertError } = await supabase.from('monthly_obligations').insert(obligations);
  if (!insertError) {
    invalidate('obligations');
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
  }
}

export async function markObligationAsPaid(
  obligationId: string,
  obligation: MonthlyObligation,
  actualAmount?: number
): Promise<{ obligation: MonthlyObligation; expense: Expense }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const { data: obligationRow, error: obErr } = await supabase
    .from('monthly_obligations')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', obligationId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (obErr) throw obErr;

  // Obrigação foi marcada como paga e, em qualquer ramo abaixo, um expense é
  // criado/atualizado/reutilizado — invalida ambas as caches já aqui.
  invalidate('obligations');
  invalidate('expenses');

  const expenseAmount = actualAmount ?? obligation.amount;

  // Dedup: se já existe expense com o mesmo recurring_expense_id neste mês, reutiliza
  if (obligation.recurringExpenseId) {
    const { data: existing } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('recurring_expense_id', obligation.recurringExpenseId)
      .gte('date', `${currentMonth}-01`)
      .lte('date', `${currentMonth}-31`)
      .maybeSingle();

    if (existing) {
      // Para despesas variáveis, atualiza o valor real se diferente do estimado
      if (actualAmount !== undefined && actualAmount !== (existing.amount as number)) {
        const { data: updated } = await supabase
          .from('expenses')
          .update({ amount: actualAmount })
          .eq('id', existing.id)
          .eq('user_id', user.id)
          .select()
          .single();
        return {
          obligation: toMonthlyObligation(obligationRow),
          expense: toExpense(updated ?? existing),
        };
      }
      return {
        obligation: toMonthlyObligation(obligationRow),
        expense: toExpense(existing),
      };
    }
  }

  const { data: expenseRow, error: expErr } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      type: 'expense',
      amount: expenseAmount,
      description: obligation.description,
      category: obligation.category,
      date: today,
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

export async function unmarkObligationAsPaid(
  obligationId: string,
  expenseId: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  await Promise.all([
    supabase
      .from('monthly_obligations')
      .update({ status: 'pending', paid_at: null })
      .eq('id', obligationId)
      .eq('user_id', user.id),
    supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('user_id', user.id),
  ]);
  invalidate('obligations');
  invalidate('expenses');
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
  // Obrigação herda apenas due_day. Sem due_day válido, fica null (sem prazo).
  const due =
    typeof rec.dueDay === 'number' && rec.dueDay >= 1 && rec.dueDay <= 31
      ? rec.dueDay
      : null;
  const { data, error } = await supabase
    .from('monthly_obligations')
    .insert({
      user_id: user.id,
      recurring_expense_id: rec.id,
      month: currentMonth,
      amount: rec.amount,
      description: rec.description,
      category: rec.category,
      due_day: due,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return null;
  invalidate('obligations');
  return toMonthlyObligation(data);
}

// Remove as obrigações do mês atual de um conjunto de recorrentes. Usado pelo
// onboarding para tornar o passo "contas fixas" idempotente: ao voltar e
// avançar de novo, as obrigações criadas antes são apagadas e recriadas a
// partir dos valores atuais, sem duplicar (deleteRecurringExpense não cascateia
// para monthly_obligations de forma garantida neste schema).
export async function deleteObligationsByRecurringIds(
  recurringIds: string[]
): Promise<void> {
  if (recurringIds.length === 0) return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const currentMonth = new Date().toISOString().slice(0, 7);
  await supabase
    .from('monthly_obligations')
    .delete()
    .eq('user_id', user.id)
    .eq('month', currentMonth)
    .in('recurring_expense_id', recurringIds);
  invalidate('obligations');
}

// ─── Cartões de Crédito ───────────────────────────────────────────────────────

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
  invalidate('creditCards');
  return toCreditCard(row);
}

export async function updateCreditCard(
  id: string,
  data: Partial<Omit<CreditCard, 'id' | 'userId' | 'createdAt'>>
): Promise<CreditCard> {
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
  invalidate('creditCards');
  return toCreditCard(row);
}

export async function deleteCreditCard(id: string): Promise<void> {
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
  invalidate('creditCards');
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
  invalidate('goalContributions');

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
