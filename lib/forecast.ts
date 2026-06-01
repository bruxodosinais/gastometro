import { getMonthKey } from './calculations';
import type { RecurringExpense, Expense } from './types';

export type ForecastMonth = {
  monthKey: string;    // "2026-06"
  income: number;      // receita fixa prevista
  expense: number;     // despesa fixa prevista (perpétua + parcelados ainda ativos)
  balance: number;     // income - expense
  cumulative: number;  // saldo acumulado até este mês
};

export type ForecastResult = {
  monthlyIncome: number;   // receita fixa mensal perpétua (sem parcelados)
  monthlyExpense: number;  // custo fixo mensal base perpétuo (sem parcelados)
  months: ForecastMonth[]; // projeção mês a mês
  hasData: boolean;        // false se não houver nenhum recorrente ativo
};

// Conta quantas parcelas de um recorrente parcelado já foram lançadas
// (cruza com expenses, mesmo critério do RecorrenteCard).
function launchedInstallments(rec: RecurringExpense, expenses: Expense[]): number {
  return expenses.filter((e) => e.recurringExpenseId === rec.id).length;
}

export function computeForecast(
  recurrings: RecurringExpense[],
  expenses: Expense[],
  fromDate: Date,
  monthsAhead = 12,
): ForecastResult {
  const active = recurrings.filter((r) => r.active);
  const incomeRecs = active.filter((r) => r.type === 'income');
  const expenseRecs = active.filter((r) => r.type === 'expense');

  // Receita/despesa "perpétua": recorrentes sem totalInstallments
  const perpetualIncome = incomeRecs
    .filter((r) => !r.totalInstallments)
    .reduce((s, r) => s + r.amount, 0);
  const perpetualExpense = expenseRecs
    .filter((r) => !r.totalInstallments)
    .reduce((s, r) => s + r.amount, 0);

  // Parcelados com parcelas restantes: aparecem apenas nos próximos `remaining` meses.
  const installmentExpenses = expenseRecs
    .filter((r) => typeof r.totalInstallments === 'number' && r.totalInstallments >= 1)
    .map((r) => ({
      amount: r.amount,
      remaining: Math.max(
        0,
        (r.totalInstallments as number) - launchedInstallments(r, expenses),
      ),
    }))
    .filter((r) => r.remaining > 0);

  const months: ForecastMonth[] = [];
  let cumulative = 0;

  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth() + i, 1);
    const monthKey = getMonthKey(d);

    // Parcelados cujo índice de mês ainda está dentro das parcelas restantes
    const installmentThisMonth = installmentExpenses
      .filter((r) => i < r.remaining)
      .reduce((s, r) => s + r.amount, 0);

    const income = perpetualIncome;
    const expense = perpetualExpense + installmentThisMonth;
    const balance = income - expense;
    cumulative += balance;

    months.push({ monthKey, income, expense, balance, cumulative });
  }

  return {
    monthlyIncome: perpetualIncome,
    monthlyExpense: perpetualExpense,
    months,
    hasData: incomeRecs.length > 0 || expenseRecs.length > 0,
  };
}
