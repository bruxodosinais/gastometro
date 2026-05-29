import { EntryType, ExpenseCategory, EXPENSE_CATEGORIES, CategorySummary, Expense } from './types';

// Thresholds de variação de categoria vs média dos meses anteriores.
// IMPORTANTE: valores em UNIDADE PERCENTUAL (ex.: 20 = 20%), pois `percentChange`
// já é calculado em pontos percentuais. Os valores diferentes são intencionais —
// cada contexto tem sua sensibilidade.
export const CATEGORY_ALERT_THRESHOLD = 20;   // getCategoryAlerts — uso geral (isAlert)
export const CATEGORY_PAGE_THRESHOLD = 5;     // /categorias — alta/baixa vs média
export const CATEGORY_ANOMALY_THRESHOLD = 30; // AnomaliaCard — só anomalias severas

export function getMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1);
  // Monta "Maio de 2026" explicitamente: só o mês recebe inicial maiúscula.
  // A preposição "de" fica sempre minúscula (padrão pt-BR). Não usar a
  // classe CSS `capitalize` em cima deste retorno — ela maiusculiza cada
  // palavra e quebra a preposição ("Maio De 2026").
  const month = d.toLocaleDateString('pt-BR', { month: 'long' });
  const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
  return `${monthCapitalized} de ${y}`;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 100_000) {
    return `${sign}R$ ${Math.round(abs / 1_000).toLocaleString('pt-BR')}k`;
  }
  return formatCurrency(value);
}

export function groupByMonth(expenses: Expense[]): Record<string, Expense[]> {
  return expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    const key = e.date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

export function calculateTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function calculateTotalByType(entries: Expense[], type: EntryType): number {
  return entries.filter((e) => e.type === type).reduce((sum, e) => sum + e.amount, 0);
}

export function calculateByCategory(entries: Expense[]): Record<ExpenseCategory, number> {
  const result = Object.fromEntries(
    EXPENSE_CATEGORIES.map((c) => [c, 0])
  ) as Record<ExpenseCategory, number>;
  for (const e of entries) {
    if (e.type === 'expense' && e.category in result) {
      result[e.category as ExpenseCategory] += e.amount;
    }
  }
  return result;
}

export function getCategoryAlerts(
  entries: Expense[],
  currentMonth: string
): CategorySummary[] {
  // Alertas são baseados apenas nos gastos
  const expenses = entries.filter((e) => e.type === 'expense');
  const grouped = groupByMonth(expenses);
  const currentExpenses = grouped[currentMonth] ?? [];
  const currentByCategory = calculateByCategory(currentExpenses);

  const prevMonths = Object.keys(grouped)
    .filter((m) => m < currentMonth)
    .sort()
    .slice(-3);

  return EXPENSE_CATEGORIES.map((category) => {
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
    const isAlert = average > 0 && percentChange > CATEGORY_ALERT_THRESHOLD;

    return { category, total, average, percentChange, isAlert };
  });
}

export function getBillingMonthOptions(): Array<{ value: string; label: string }> {
  const today = new Date();
  const options: Array<{ value: string; label: string }> = [];
  for (let i = -3; i <= 1; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const value = getMonthKey(d);
    options.push({ value, label: getMonthLabel(value) });
  }
  return options;
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
