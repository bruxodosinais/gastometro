import { getRecurringExpenses } from './storage/recurring';
import { getExpenses } from './storage/expenses';
import { calculateTotalByType, getMonthKey } from './calculations';

export type MonthlyBaseSource = 'recurring' | 'expenses_avg' | 'none';

export interface MonthlyBaseCost {
  monthlyBase: number;
  source: MonthlyBaseSource;
  recurringCount: number;
}

// Limiar mínimo de R$ 100 em recorrentes pra evitar falso positivo de quem
// cadastrou uma única despesa pequena de teste (ex.: "Netflix R$ 39") — nesse
// caso a média de 3 meses é mais representativa do custo real do usuário.
const RECURRING_MIN_TOTAL = 100;

// Estima o custo mensal "fixo" do usuário pra sugerir o tamanho ideal da
// reserva de emergência. Fonte primária: soma das recorrentes ativas de
// despesa com valor fixo (isVariable=false). Fallback: média dos últimos 3
// meses completos de expenses, ignorando meses sem lançamento.
//
// Não recebe userId — usa RLS via getRecurringExpenses/getExpenses, mesmo
// padrão das demais leituras de storage.
export async function getMonthlyBaseCost(): Promise<MonthlyBaseCost> {
  const recurring = await getRecurringExpenses();
  const fixed = recurring.filter(
    (r) => r.active && r.type === 'expense' && !r.isVariable,
  );
  const recurringTotal = fixed.reduce((s, r) => s + Number(r.amount), 0);

  if (recurringTotal >= RECURRING_MIN_TOTAL) {
    return {
      monthlyBase: recurringTotal,
      source: 'recurring',
      recurringCount: fixed.length,
    };
  }

  const expenses = await getExpenses();
  const now = new Date();
  const totals: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(d);
    const total = calculateTotalByType(
      expenses.filter((e) => e.date.slice(0, 7) === key),
      'expense',
    );
    if (total > 0) totals.push(total);
  }

  if (totals.length === 0) {
    return { monthlyBase: 0, source: 'none', recurringCount: fixed.length };
  }

  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  return { monthlyBase: avg, source: 'expenses_avg', recurringCount: fixed.length };
}
