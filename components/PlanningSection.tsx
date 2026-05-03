'use client';

import { useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { upsertMonthlyPlan } from '@/lib/storage';
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import { Budget, Expense, GoalContribution, MonthlyPlan } from '@/lib/types';

interface Props {
  period: string;
  income: number;
  spent: number;
  fixedCosts: number;
  budgets: Budget[];
  periodExpenses: Expense[];
  monthlyPlan: MonthlyPlan | null;
  contributions: GoalContribution[];
  onPlanUpdate: (plan: MonthlyPlan) => void;
}

export default function PlanningSection({
  period,
  income,
  spent,
  fixedCosts,
  budgets,
  periodExpenses,
  monthlyPlan,
  contributions,
  onPlanUpdate,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editIncome, setEditIncome] = useState('');
  const [editSavings, setEditSavings] = useState('');
  const [saving, setSaving] = useState(false);

  const expectedIncome = monthlyPlan?.expectedIncome ?? 0;
  const savingsGoal = monthlyPlan?.savingsGoal ?? 0;
  const hasPlan = monthlyPlan !== null;

  // Métricas derivadas
  const balance = income - spent;
  const manualContribution = contributions
    .filter((c) => c.date.startsWith(period))
    .reduce((s, c) => s + c.amount, 0);
  const savedAmount = savingsGoal > 0 && balance >= savingsGoal
    ? savingsGoal
    : manualContribution;
  const savingsPct = savingsGoal > 0 ? (savedAmount / savingsGoal) * 100 : null;
  const freeAmount = expectedIncome - fixedCosts - savingsGoal;
  const freeRemaining = expectedIncome - savingsGoal - spent;

  type IncomeStatus = 'above' | 'ok' | 'below';
  const incomeStatus: IncomeStatus | null =
    expectedIncome > 0
      ? income > expectedIncome
        ? 'above'
        : income >= expectedIncome * 0.9
        ? 'ok'
        : 'below'
      : null;

  // Insights automáticos
  const insights: string[] = [];
  if (savingsPct !== null) {
    if (savingsPct >= 100) {
      insights.push(`✓ Meta de poupança atingida! (${formatCurrency(savingsGoal)})`);
    } else if (savingsPct > 0) {
      insights.push(`Você já atingiu ${Math.round(Math.max(0, savingsPct))}% da meta de economia`);
    }
  }
  if (expectedIncome > 0 && income < expectedIncome * 0.9) {
    insights.push(`Receita ${formatCurrency(expectedIncome - income)} abaixo do previsto`);
  }
  if (freeRemaining > 0 && expectedIncome > 0) {
    insights.push(`Ainda restam ${formatCurrency(freeRemaining)} livres este mês`);
  } else if (freeRemaining < 0 && expectedIncome > 0) {
    insights.push(`${formatCurrency(Math.abs(freeRemaining))} além do valor livre planejado`);
  }
  budgets.forEach((b) => {
    const total = periodExpenses
      .filter((e) => e.category === b.category)
      .reduce((s, e) => s + e.amount, 0);
    const pct = b.amount > 0 ? (total / b.amount) * 100 : 0;
    if (pct >= 90 && total > 0) {
      insights.push(`${b.category} consumiu ${Math.round(pct)}% do limite`);
    }
  });

  function openEdit() {
    setEditIncome(expectedIncome > 0 ? String(expectedIncome) : '');
    setEditSavings(savingsGoal > 0 ? String(savingsGoal) : '');
    setEditMode(true);
  }

  async function handleSave() {
    const inc = parseFloat(editIncome.replace(',', '.')) || 0;
    const sav = parseFloat(editSavings.replace(',', '.')) || 0;
    setSaving(true);
    try {
      const updated = await upsertMonthlyPlan(period, inc, sav);
      onPlanUpdate(updated);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6">
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gray-800 font-semibold text-sm">
          Planejamento · <span className="capitalize font-normal text-gray-500">{getMonthLabel(period)}</span>
        </h2>
        {hasPlan && !editMode && (
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50"
          >
            <Pencil size={12} /> Editar plano
          </button>
        )}
      </div>

      {/* Formulário de edição */}
      {editMode && (
        <div className="bg-white border border-mint-500/30 rounded-2xl p-5 mb-3">
          <p className="text-gray-700 text-sm font-semibold mb-4">
            Configurar plano · {getMonthLabel(period)}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                Receita prevista (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  R$
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={editIncome}
                  onChange={(e) => setEditIncome(e.target.value)}
                  placeholder="0,00"
                  autoFocus
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 text-base font-semibold placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                Meta de poupança (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  R$
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={editSavings}
                  onChange={(e) => setEditSavings(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 text-base font-semibold placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl disabled:opacity-70 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Check size={16} /> Salvar plano
                </>
              )}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors border border-gray-200"
              aria-label="Cancelar"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Estado: sem plano configurado */}
      {!hasPlan && !editMode && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 text-center">
          <p className="text-gray-500 text-sm mb-1">
            Nenhum plano para {getMonthLabel(period)}
          </p>
          <p className="text-gray-500 text-xs mb-4">
            Defina sua receita prevista e meta de poupança para acompanhar o mês
          </p>
          <button
            onClick={openEdit}
            className="px-5 py-2.5 rounded-xl active:scale-95 text-white text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
          >
            Configurar agora
          </button>
        </div>
      )}

      {/* Métricas (plano configurado e fora do modo de edição) */}
      {hasPlan && !editMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Card 1 — Receita prevista vs realizada */}
          <div
            className={`rounded-2xl p-4 border ${
              incomeStatus === 'above'
                ? 'bg-mint/5 border-green-500/20'
                : incomeStatus === 'below'
                ? 'bg-yellow-500/5 border-yellow-500/20'
                : 'bg-white border-gray-100'
            }`}
          >
            <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-2">
              Receita prevista vs realizada
            </p>
            <div className="flex items-start gap-5">
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Previsto</p>
                <p className="text-base font-bold text-gray-700">{formatCurrency(expectedIncome)}</p>
              </div>
              <div className="w-px bg-gray-50 self-stretch" />
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Realizado</p>
                <p
                  className={`text-base font-bold ${
                    incomeStatus === 'above'
                      ? 'text-mint-500'
                      : incomeStatus === 'below'
                      ? 'text-yellow-400'
                      : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(income)}
                </p>
              </div>
            </div>
            <p
              className={`text-xs font-medium mt-2 ${
                incomeStatus === 'above'
                  ? 'text-mint-500/80'
                  : incomeStatus === 'below'
                  ? 'text-yellow-400/80'
                  : 'text-gray-500/80'
              }`}
            >
              {incomeStatus === 'above'
                ? `Acima do previsto (+${formatCurrency(income - expectedIncome)})`
                : incomeStatus === 'below'
                ? `Abaixo do previsto (−${formatCurrency(expectedIncome - income)})`
                : 'Dentro do esperado'}
            </p>
          </div>

          {/* Card 2 — Meta de poupança */}
          <div
            className={`rounded-2xl p-4 border ${
              savingsPct !== null && savingsPct >= 100
                ? 'bg-mint/5 border-green-500/20'
                : 'bg-white border-gray-100'
            }`}
          >
            <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-2">
              Meta de poupança
            </p>
            <p
              className={`text-xl font-bold ${
                savedAmount >= savingsGoal && savingsGoal > 0
                  ? 'text-mint-500'
                  : 'text-gray-900'
              }`}
            >
              {formatCurrency(savedAmount)}
            </p>
            {savingsGoal > 0 ? (
              <>
                <p className="text-gray-500 text-xs mt-0.5 mb-2">
                  de {formatCurrency(savingsGoal)} · {Math.round(Math.max(0, savingsPct ?? 0))}%
                </p>
                <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (savingsPct ?? 0) >= 100
                        ? 'bg-mint'
                        : (savingsPct ?? 0) >= 50
                        ? 'bg-blue-500'
                        : 'bg-yellow-500'
                    }`}
                    style={{ width: `${Math.min(savingsPct ?? 0, 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-xs mt-1">sem meta de poupança definida</p>
            )}
          </div>

          {/* Card 3 — Valor livre (largura total no desktop) */}
          <div
            className={`md:col-span-2 rounded-2xl p-4 border ${
              freeRemaining < 0
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-white border-gray-100'
            }`}
          >
            <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-2">
              Valor livre para gastar
            </p>
            <div className="flex items-start gap-6 flex-wrap">
              <div>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Planejado</p>
                <p
                  className={`text-2xl font-bold ${
                    freeAmount < 0 ? 'text-red-400' : 'text-gray-900'
                  }`}
                >
                  {freeAmount < 0 ? '−' : ''}{formatCurrency(Math.abs(freeAmount))}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {formatCurrency(expectedIncome)} − {formatCurrency(fixedCosts)} fixos − {formatCurrency(savingsGoal)} poupança
                </p>
              </div>
              {expectedIncome > 0 && (
                <>
                  <div className="hidden md:block w-px bg-gray-50 self-stretch" />
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">
                      Restante agora
                    </p>
                    <p
                      className={`text-xl font-bold ${
                        freeRemaining < 0 ? 'text-red-400' : 'text-mint-500'
                      }`}
                    >
                      {freeRemaining < 0 ? '−' : ''}{formatCurrency(Math.abs(freeRemaining))}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      após {formatCurrency(spent)} gastos no período
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card 4 — Insights automáticos */}
          {insights.length > 0 && (
            <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-4">
              <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-3">
                Insights automáticos
              </p>
              <ul className="space-y-2">
                {insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-mint-500 mt-0.5 flex-shrink-0">→</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
