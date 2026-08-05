import type { Budget, Expense } from './types';

// ─── Fonte única da verdade dos alertas de orçamento ──────────────────────────
//
// Antes deste módulo, "quanto já gastei nessa categoria" estava duplicado em
// app/(app)/orcamentos/page.tsx e no budgetOverflows da Home, com convenções
// de período diferentes — o usuário via dois números para o mesmo gasto.
// Tudo que precisa avaliar limite de categoria (barra da tela de Orçamentos,
// hint em tempo real da tela de lançar, modal de confirmação) deve usar
// spentForCategory/evaluateBudget daqui. Funções puras: sem I/O, sem React.

export const BUDGET_WARN = 70; // atenção
export const BUDGET_DANGER = 90; // prestes a estourar
export const BUDGET_OVER = 100; // estourou

export type BudgetStatus = 'no-budget' | 'ok' | 'warn' | 'danger' | 'over';

// Soma os gastos da categoria no período (YYYY-MM).
// Mesma convenção das duas telas hoje: conta TODOS os type='expense' da
// categoria, inclusive compras no crédito e recorrentes auto-lançados.
// 'Saldo inicial' é categoria de sistema (onboarding financeiro) e nunca
// entra em orçamento.
export function spentForCategory(
  expenses: Expense[],
  category: string,
  periodKey: string
): number {
  if (category === 'Saldo inicial') return 0;
  return expenses
    .filter(
      (e) => e.type === 'expense' && e.date.slice(0, 7) === periodKey && e.category === category
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

// Único tradutor de "% do limite" → degrau. Quem exibe orçamento (hint da
// tela de Lançar, faixas e pills da /orcamentos) deriva daqui, para um degrau
// novo aparecer em todas as telas de uma vez.
export function statusFromPct(pct: number): BudgetStatus {
  if (pct >= BUDGET_OVER) return 'over';
  if (pct >= BUDGET_DANGER) return 'danger';
  if (pct >= BUDGET_WARN) return 'warn';
  return 'ok';
}

export interface BudgetEvaluation {
  status: BudgetStatus;
  limit: number;
  spent: number;
  projected: number; // spent + extraAmount
  pct: number; // spent / limit * 100
  projectedPct: number; // projected / limit * 100
  remaining: number; // max(limit - projected, 0)
  overBy: number; // max(projected - limit, 0)
}

// Avalia a saúde do orçamento de UMA categoria, opcionalmente somando um
// valor ainda não lançado (`extraAmount`) — é isso que permite avisar ANTES
// de salvar. O status é sempre calculado sobre projectedPct.
export function evaluateBudget({
  budgets,
  expenses,
  category,
  periodKey,
  extraAmount = 0,
}: {
  budgets: Budget[];
  expenses: Expense[];
  category: string;
  periodKey: string;
  extraAmount?: number;
}): BudgetEvaluation {
  const spent = spentForCategory(expenses, category, periodKey);
  const projected = spent + (extraAmount || 0);
  const budget = budgets.find((b) => b.category === category);
  const limit = budget?.amount ?? 0;

  // Sem orçamento (ou orçamento zerado/negativo) não há régua para comparar.
  if (!budget || limit <= 0) {
    return {
      status: 'no-budget',
      limit: 0,
      spent,
      projected,
      pct: 0,
      projectedPct: 0,
      remaining: 0,
      overBy: 0,
    };
  }

  const pct = (spent / limit) * 100;
  const projectedPct = (projected / limit) * 100;

  return {
    status: statusFromPct(projectedPct),
    limit,
    spent,
    projected,
    pct,
    projectedPct,
    remaining: Math.max(limit - projected, 0),
    overBy: Math.max(projected - limit, 0),
  };
}
