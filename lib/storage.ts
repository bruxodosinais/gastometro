import { Category, Expense } from './types';

const KEY = 'gastometro_expenses';

export function getExpenses(): Expense[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Expense[]) : [];
  } catch {
    return [];
  }
}

export function saveExpenses(list: Expense[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addExpense(data: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const all = getExpenses();
  const exp: Expense = { ...data, id: crypto.randomUUID(), createdAt: Date.now() };
  saveExpenses([...all, exp]);
  return exp;
}

export function deleteExpense(id: string): void {
  saveExpenses(getExpenses().filter((e) => e.id !== id));
}
