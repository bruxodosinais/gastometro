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
  topCategory: { cat: string; total: number } | null;
  monthlyPlan: MonthlyPlan | null;
  onClose: () => void;
  onViewHistory: () => void;
}

export default function MonthlyCloseModal({
  prevMonthLabel,
  income,
  spent,
  topCategory,
  monthlyPlan,
  onClose,
  onViewHistory,
}: Props) {
  const { categories: customs } = useCustomCategories();
  const balance = income - spent;
  const savingsGoalMet = monthlyPlan != null && monthlyPlan.savingsGoal > 0 && balance >= monthlyPlan.savingsGoal;
  const motivational =
    balance >= 0
      ? 'Você fechou o mês no azul! Continue assim.'
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
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Receitas totais</span>
            <span className="font-semibold text-sm" style={{ color: '#00b87a' }}>{formatCurrency(income)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Gastos totais</span>
            <span className="font-semibold text-sm" style={{ color: '#f04e5e' }}>{formatCurrency(spent)}</span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium text-sm">Saldo</span>
            <span className="font-bold text-base" style={{ color: balance >= 0 ? '#00b87a' : '#f04e5e' }}>
              {formatCurrency(balance)}
            </span>
          </div>
          {monthlyPlan != null && monthlyPlan.savingsGoal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Meta de poupança</span>
              <span className="text-sm font-semibold" style={{ color: savingsGoalMet ? '#00b87a' : '#f59e0b' }}>
                {savingsGoalMet ? '✓ Atingida' : `✗ Não atingida (${formatCurrency(monthlyPlan.savingsGoal)})`}
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
            style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
