import type { Expense, MonthlyPlan } from './types';

// ─── Fonte única do "orçamento livre do mês" ──────────────────────────────────
//
// A Home e a tela /orcamentos mostram O MESMO número (quanto sobra pra gastar
// no mês). Antes a conta vivia só dentro de app/(app)/app/page.tsx; qualquer
// segunda tela que a copiasse ia divergir no primeiro ajuste. Aqui ficam as
// duas peças: a agregação do período e a fórmula do orçamento.
//
// NADA aqui muda de fórmula em relação ao que a Home já fazia.

export interface PeriodTotals {
  /** Lançamentos do período, já sem a âncora de sistema 'Saldo inicial'. */
  entries: Expense[];
  income: number;
  spent: number;
  /** Compras no crédito do período (não movem caixa até a fatura ser paga). */
  creditTotal: number;
  /** Gasto em CAIXA: spent − compras no crédito. */
  debitSpent: number;
}

// 'Saldo inicial' é âncora de sistema (ajuste do saldo cumulativo vindo do
// onboarding), não um movimento do mês — fica de fora de ENTROU/SAIU.
export function aggregatePeriod(expenses: Expense[], periodKey: string): PeriodTotals {
  const entries = expenses.filter(
    (e) => e.date.slice(0, 7) === periodKey && e.category !== 'Saldo inicial',
  );
  let income = 0;
  let spent = 0;
  let creditTotal = 0;
  for (const e of entries) {
    if (e.type === 'income') {
      income += e.amount;
    } else {
      spent += e.amount;
      if (e.isCredit === true) creditTotal += e.amount;
    }
  }
  return { entries, income, spent, creditTotal, debitSpent: spent - creditTotal };
}

export interface MonthlyBudgetSummary {
  savingsGoal: number;
  /** valorLivreParaGastarPlanejado — o teto do mês. */
  planned: number;
  /** orcamentoRestante — planned − debitSpent (pode ser negativo). */
  remaining: number;
  /** budgetPct — % do teto já usado, limitado a 100. */
  pct: number;
  /**
   * base − fixedCosts − savingsGoal. Diagnóstico do PLANO ("o plano fecha?"),
   * NUNCA saldo do mês: não desconta nada do que já foi gasto e por isso não
   * responde "quanto sobrou" — para isso existe `remaining`. Serve ao alerta
   * "suas contas fixas + meta passam da renda em ~X", que precisa comparar o
   * compromisso estrutural com a renda, não com o caixa do momento.
   */
  structuralMargin: number;
}

// Base do orçamento livre: receita real lançada (income); sem receita no mês,
// cai pra renda esperada do plano.
//
// As contas fixas NÃO são pré-reservadas do `planned`. Elas já entram como
// gasto quando pagas (`debitSpent` soma todos os lançamentos do período,
// inclusive os que quitam fixas), então subtraí-las antes descontava o mesmo
// dinheiro duas vezes: com plano de 4.500 / fixas 1.645 / meta 450, pagar
// exatamente as fixas derrubava o disponível de 2.405 para 760 — e o MESMO
// estado factual voltava a 2.405 assim que a receita era lançada, porque o
// caminho com renda nunca reservou nada. Os dois caminhos agora convergem no
// comportamento do dominante. Quem precisa da pergunta estrutural ("o plano
// fecha?") usa `structuralMargin`, não `planned`.
export function computeMonthlyBudget({
  income,
  fixedCosts,
  debitSpent,
  monthlyPlan,
}: {
  income: number;
  fixedCosts: number;
  debitSpent: number;
  monthlyPlan: MonthlyPlan | null;
}): MonthlyBudgetSummary {
  const savingsGoal = monthlyPlan?.savingsGoal ?? 0;
  const expected = monthlyPlan?.expectedIncome ?? 0;
  const base = income > 0 ? income : expected;
  const planned = base - savingsGoal;
  const structuralMargin = base - fixedCosts - savingsGoal;
  const remaining = planned - debitSpent;
  const pct =
    planned > 0 ? Math.min((debitSpent / planned) * 100, 100) : debitSpent > 0 ? 100 : 0;
  return { savingsGoal, planned, remaining, pct, structuralMargin };
}

// Custos fixos = recorrentes de despesa ativas (mesma definição da Home).
export function sumFixedCosts(
  recurringExpenses: { active: boolean; type: string; amount: number }[],
): number {
  return recurringExpenses
    .filter((r) => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);
}

// Dias que faltam para o fim do mês do período. Fora do mês corrente, 0.
export function getDaysRemaining(periodKey: string, isCurrentMonth: boolean): number {
  if (!isCurrentMonth) return 0;
  const [year, month] = periodKey.split('-').map(Number);
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  return totalDaysInMonth - new Date().getDate();
}
