import type { Expense } from '@/lib/types';

export type MonthlyBucket = {
  monthKey: string;   // YYYY-MM
  label: string;      // "Mai" ou "Mai/26"
  income: number;
  expense: number;
  balance: number;    // income − expense
};

/**
 * Constrói buckets por mês mesmo quando o mês não tem nenhum lançamento —
 * indispensável para os charts de evolução não pularem buracos no eixo X.
 */
export function buildMonthlyBuckets(
  entries: Expense[],
  months: string[],
): MonthlyBucket[] {
  // Indexa por mês uma única vez (O(n) em vez de filter por mês).
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    const acc = byMonth.get(key) ?? { income: 0, expense: 0 };
    if (e.type === 'income') acc.income += e.amount;
    else if (e.type === 'expense') acc.expense += e.amount;
    byMonth.set(key, acc);
  }
  const spansMultipleYears = new Set(months.map((m) => m.slice(0, 4))).size > 1;
  return months.map((monthKey) => {
    const acc = byMonth.get(monthKey) ?? { income: 0, expense: 0 };
    return {
      monthKey,
      label: shortMonthLabel(monthKey, spansMultipleYears),
      income: acc.income,
      expense: acc.expense,
      balance: acc.income - acc.expense,
    };
  });
}

/**
 * "Mai" se cabe em 1 ano; "Mai/26" quando o range cruza ano.
 */
export function shortMonthLabel(monthKey: string, withYear: boolean): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  const base = d
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
  const capitalized = base.charAt(0).toUpperCase() + base.slice(1);
  return withYear ? `${capitalized}/${y.slice(2)}` : capitalized;
}

/**
 * Cor amigável p/ y-axis: 12k em vez de 12000.
 */
export function formatAxisCurrency(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  if (v <= -1000) return `-${(Math.abs(v) / 1000).toFixed(0)}k`;
  return String(v);
}
