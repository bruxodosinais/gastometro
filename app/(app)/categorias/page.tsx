'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Pencil, Check, X, Trash2 } from 'lucide-react';
import { getExpenses, getBudgets, upsertBudget, deleteBudget } from '@/lib/storage';
import {
  formatCurrency,
  getCategoryAlerts,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import { Budget, CategorySummary, Expense, ExpenseCategory } from '@/lib/types';

export default function CategoriasPage() {
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ready, setReady] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  useEffect(() => {
    Promise.all([getExpenses(), getBudgets()]).then(([exp, bud]) => {
      setExpenses(exp);
      setBudgets(bud);
      setReady(true);
    });
  }, []);

  const budgetMap = Object.fromEntries(budgets.map((b) => [b.category, b.amount])) as Record<ExpenseCategory, number | undefined>;

  function openEdit(category: ExpenseCategory) {
    setEditingCategory(category);
    setEditAmount(budgetMap[category] != null ? String(budgetMap[category]) : '');
  }

  function cancelEdit() {
    setEditingCategory(null);
    setEditAmount('');
  }

  async function saveEdit(category: ExpenseCategory) {
    const num = parseFloat(editAmount.replace(',', '.'));
    if (!num || num <= 0) return;
    setSavingBudget(true);
    try {
      await upsertBudget(category, num);
      setBudgets((prev) => {
        const exists = prev.find((b) => b.category === category);
        if (exists) return prev.map((b) => b.category === category ? { ...b, amount: num } : b);
        return [...prev, { id: crypto.randomUUID(), category, amount: num }];
      });
      setEditingCategory(null);
      setEditAmount('');
    } finally {
      setSavingBudget(false);
    }
  }

  async function removeEdit(category: ExpenseCategory) {
    setSavingBudget(true);
    try {
      await deleteBudget(category);
      setBudgets((prev) => prev.filter((b) => b.category !== category));
      setEditingCategory(null);
      setEditAmount('');
    } finally {
      setSavingBudget(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const summaries: CategorySummary[] = getCategoryAlerts(expenses, period);
  const maxTotal = Math.max(...summaries.map((s) => Math.max(s.total, s.average)), 1);

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Categorias</h1>
      <p className="text-slate-400 text-sm capitalize mb-5">{getMonthLabel(period)}</p>

      <PeriodSelector />

      {/* Legenda */}
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-violet-500" />
          <span>Mês atual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-600" />
          <span>Média anterior</span>
        </div>
      </div>

      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        {summaries.map((summary) => {
          const cfg = CATEGORY_CONFIG[summary.category];
          const currentWidth = (summary.total / maxTotal) * 100;
          const avgWidth = (summary.average / maxTotal) * 100;
          const hasData = summary.total > 0 || summary.average > 0;
          const budget = budgetMap[summary.category];
          const budgetPct = budget != null && budget > 0 ? (summary.total / budget) * 100 : null;
          const isEditing = editingCategory === summary.category;

          let budgetBarColor = 'bg-green-500';
          if (budgetPct != null) {
            if (budgetPct > 100) budgetBarColor = 'bg-red-500';
            else if (budgetPct >= 80) budgetBarColor = 'bg-yellow-500';
          }

          return (
            <div
              key={summary.category}
              className={`bg-slate-900 border rounded-2xl p-4 ${
                summary.isAlert ? 'border-red-500/30' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${cfg.bgClass}`}>
                    {cfg.icon}
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">{summary.category}</p>
                    {summary.isAlert && (
                      <p className="text-red-400 text-xs font-medium">⚠ Acima do normal</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {summary.average > 0 && (
                    <div
                      className={`flex items-center gap-1 text-sm font-semibold ${
                        summary.percentChange > 20
                          ? 'text-red-400'
                          : summary.percentChange < -20
                          ? 'text-green-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {summary.percentChange > 5 ? (
                        <TrendingUp size={14} />
                      ) : summary.percentChange < -5 ? (
                        <TrendingDown size={14} />
                      ) : (
                        <Minus size={14} />
                      )}
                      {summary.percentChange > 0 ? '+' : ''}
                      {Math.round(summary.percentChange)}%
                    </div>
                  )}
                  <button
                    onClick={() => isEditing ? cancelEdit() : openEdit(summary.category)}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    title="Definir limite mensal"
                  >
                    {isEditing ? <X size={13} /> : <Pencil size={13} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>
                  Atual:{' '}
                  <span className={`font-semibold ${cfg.textClass}`}>
                    {formatCurrency(summary.total)}
                  </span>
                </span>
                {summary.average > 0 && (
                  <span>
                    Média:{' '}
                    <span className="text-slate-300 font-medium">
                      {formatCurrency(summary.average)}
                    </span>
                  </span>
                )}
              </div>

              {hasData && (
                <div className="space-y-1.5 mb-3">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cfg.barClass}`}
                      style={{ width: `${currentWidth}%` }}
                    />
                  </div>
                  {summary.average > 0 && (
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-600 transition-all"
                        style={{ width: `${avgWidth}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {!hasData && <div className="mb-3" />}

              {/* Edição de limite */}
              {isEditing && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                    Limite mensal (R$)
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="1"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="0,00"
                        autoFocus
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => saveEdit(summary.category)}
                      disabled={savingBudget}
                      className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 flex items-center justify-center transition-colors"
                    >
                      <Check size={16} className="text-white" />
                    </button>
                    {budget != null && (
                      <button
                        onClick={() => removeEdit(summary.category)}
                        disabled={savingBudget}
                        className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-60 flex items-center justify-center text-slate-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Barra de orçamento */}
              {!isEditing && budget != null && (
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Planejado</p>
                      <p className="text-slate-300 font-semibold text-sm">{formatCurrency(budget)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Gasto atual</p>
                      <p className={`font-bold text-sm ${
                        budgetPct! > 100 ? 'text-red-400' : budgetPct! >= 80 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {formatCurrency(summary.total)}{' '}
                        <span className="text-xs font-medium opacity-80">({Math.round(budgetPct!)}%)</span>
                      </p>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${budgetBarColor}`}
                      style={{ width: `${Math.min(budgetPct!, 100)}%` }}
                    />
                  </div>
                  {budgetPct! > 100 && (
                    <p className="text-red-400 text-xs mt-1 font-medium">🚨 Limite ultrapassado em {formatCurrency(summary.total - budget)}</p>
                  )}
                  {budgetPct! >= 80 && budgetPct! <= 100 && (
                    <p className="text-yellow-400 text-xs mt-1 font-medium">⚠ Restam {formatCurrency(budget - summary.total)}</p>
                  )}
                </div>
              )}

              {!hasData && !isEditing && budget == null && (
                <p className="text-slate-600 text-xs">Sem lançamentos nesta categoria</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
