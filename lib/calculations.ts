import { Category, CATEGORIES, CategorySummary, Expense } from './types';

export function getMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function groupByMonth(expenses: Expense[]): Record<string, Expense[]> {
  return expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    const key = e.date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

export function calculateByCategory(expenses: Expense[]): Record<Category, number> {
  const result = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const e of expenses) {
    result[e.category] += e.value;
  }
  return result;
}

export function calculateTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.value, 0);
}

export function getCategoryAlerts(
  expenses: Expense[],
  currentMonth: string
): CategorySummary[] {
  const grouped = groupByMonth(expenses);
  const currentExpenses = grouped[currentMonth] ?? [];
  const currentByCategory = calculateByCategory(currentExpenses);

  const prevMonths = Object.keys(grouped)
    .filter((m) => m < currentMonth)
    .sort()
    .slice(-3);

  return CATEGORIES.map((category) => {
    const total = currentByCategory[category] ?? 0;

    let average = 0;
    if (prevMonths.length > 0) {
      const sum = prevMonths.reduce((acc, month) => {
        const byCategory = calculateByCategory(grouped[month] ?? []);
        return acc + (byCategory[category] ?? 0);
      }, 0);
      average = sum / prevMonths.length;
    }

    const percentChange = average > 0 ? ((total - average) / average) * 100 : 0;
    const isAlert = average > 0 && percentChange > 20;

    return { category, total, average, percentChange, isAlert };
  });
}

export function getLastMonths(
  expenses: Expense[],
  currentMonth: string,
  count = 3
): string[] {
  const grouped = groupByMonth(expenses);
  return Object.keys(grouped)
    .filter((m) => m <= currentMonth)
    .sort()
    .reverse()
    .slice(0, count);
}
