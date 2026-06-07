'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { MonthlyPlan } from '@/lib/types';
import { useCustomCategories } from '@/hooks/useCustomCategories';

interface Props {
  prevMonthLabel: string;
  income: number;
  spent: number;
  /** Gasto em caixa (exclui compras no crédito) — base do "orçamento livre". */
  debitSpent: number;
  topCategory: { cat: string; total: number } | null;
  monthlyPlan: MonthlyPlan | null;
  onClose: () => void;
  onViewHistory: () => void;
}

export default function MonthlyCloseModal({
  prevMonthLabel,
  income,
  spent,
  debitSpent,
  topCategory,
  monthlyPlan,
  onClose,
  onViewHistory,
}: Props) {
  const { categories: customs } = useCustomCategories();
  const balance = income - spent;
  const plannedIncome = monthlyPlan?.expectedIncome ?? 0;
  const savingsGoal = monthlyPlan?.savingsGoal ?? 0;
  const hasGoal = savingsGoal > 0;
  const savingsGoalMet = hasGoal && balance >= savingsGoal;
  // Orçamento livre planejado = (renda planejada, ou a real se não houve plano)
  // menos a meta de poupança. Sem base de renda, não exibe a linha (evita
  // números sem sentido quando o mês anterior não teve renda lançada).
  const freeBudget = (plannedIncome > 0 ? plannedIncome : income) - savingsGoal;
  // Frase de reforço/hábito: prioriza o status da meta; senão, o saldo do mês.
  const savingsGap = savingsGoal - balance;
  const motivational = !hasGoal
    ? balance >= 0
      ? 'Você fechou o mês no azul! Continue assim.'
      : 'Mês desafiador, mas você acompanhou seus gastos. Isso já é meio caminho.'
    : savingsGoalMet
    ? `Você bateu sua meta de poupança de ${formatCurrency(savingsGoal)}! 🎉`
    : savingsGap > 0
    ? `Faltou ${formatCurrency(savingsGap)} para bater a meta de poupança. Bora no próximo mês!`
    : 'Mês desafiador, mas você acompanhou seus gastos. Isso já é meio caminho.';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl"
        style={{ width: '90%', maxWidth: '400px', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-gray-900 font-bold text-lg">{prevMonthLabel} encerrado 🎉</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          {plannedIncome > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Renda planejada</span>
              <span className="font-semibold text-sm text-gray-700">{formatCurrency(plannedIncome)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">{plannedIncome > 0 ? 'Renda recebida' : 'Receitas totais'}</span>
            <span className="font-semibold text-sm" style={{ color: '#00b87a' }}>{formatCurrency(income)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Gastos totais</span>
            <span className="font-semibold text-sm" style={{ color: '#f04e5e' }}>{formatCurrency(spent)}</span>
          </div>
          {freeBudget > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Orçamento livre</span>
              <span className="text-sm font-semibold" style={{ color: debitSpent <= freeBudget ? '#00b87a' : '#f04e5e' }}>
                {formatCurrency(debitSpent)} de {formatCurrency(freeBudget)}
              </span>
            </div>
          )}
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium text-sm">Saldo</span>
            <span className="font-bold text-base" style={{ color: balance >= 0 ? '#00b87a' : '#f04e5e' }}>
              {formatCurrency(balance)}
            </span>
          </div>
          {hasGoal && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Meta de poupança</span>
              <span className="text-sm font-semibold" style={{ color: savingsGoalMet ? '#00b87a' : '#f59e0b' }}>
                {savingsGoalMet
                  ? `✓ Atingida (${formatCurrency(savingsGoal)})`
                  : `✗ Faltou ${formatCurrency(Math.max(savingsGap, 0))} de ${formatCurrency(savingsGoal)}`}
              </span>
            </div>
          )}
          {topCategory != null && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Top categoria</span>
              <span className="text-gray-700 text-sm font-medium flex items-center gap-1.5">
                <span>{getCategoryDisplay(topCategory.cat, customs).icon}</span>
                {topCategory.cat}
              </span>
            </div>
          )}
        </div>

        <p className="text-gray-600 text-sm text-center px-2 mb-6">{motivational}</p>

        <div className="flex gap-2">
          <button
            onClick={onViewHistory}
            className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100"
          >
            Ver resumo completo
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
