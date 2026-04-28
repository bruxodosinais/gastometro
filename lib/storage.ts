import { createClient } from './supabase/client';
import { Budget, Category, EntryType, Expense, ExpenseCategory } from './types';

function toExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    type: ((row.type as string) ?? 'expense') as EntryType,
    amount: row.amount as number,
    description: row.description as string,
    category: row.category as Category,
    date: row.date as string,
    createdAt: row.created_at as string,
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
  data: Omit<Expense, 'id' | 'createdAt'>
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
    })
    .select()
    .single();

  if (error) throw error;
  return toExpense(row);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('budgets')
    .upsert({ user_id: user.id, category, amount }, { onConflict: 'user_id,category' });

  if (error) throw error;
}

export async function deleteBudget(category: ExpenseCategory): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('budgets').delete().eq('user_id', user.id).eq('category', category);
}
