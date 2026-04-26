'use client';

import { useEffect, useState } from 'react';
import { getExpenses } from '@/lib/storage';
import {
  calculateTotalByType,
  formatCurrency,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import { Expense } from '@/lib/types';

export default function HistoricoPage() {
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getExpenses().then((data) => {
      setExpenses(data);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const periodEntries = [...expenses]
    .filter((e) => e.date.slice(0, 7) === period)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const income = calculateTotalByType(periodEntries, 'income');
  const spent = calculateTotalByType(periodEntries, 'expense');
  const balance = income - spent;

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Histórico</h1>
      <p className="text-slate-400 text-sm mb-5 capitalize">{getMonthLabel(period)}</p>

      <PeriodSelector />

      {/* Resumo do período */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Ganhos</p>
          <p className="text-green-400 font-bold text-sm">{formatCurrency(income)}</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Gastos</p>
          <p className="text-red-400 font-bold text-sm">{formatCurrency(spent)}</p>
        </div>
        <div
          className={`rounded-xl p-3 border ${
            balance >= 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'
          }`}
        >
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Saldo</p>
          <p
            className={`font-bold text-sm ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}
          >
            {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))}
          </p>
        </div>
      </div>

      {/* Lista de lançamentos */}
      {periodEntries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">
          Nenhum lançamento neste período
        </p>
      ) : (
        <div className="space-y-2">
          {periodEntries.map((exp) => {
            const cfg = CATEGORY_CONFIG[exp.category];
            const day = exp.date.slice(8, 10);
            const month = exp.date.slice(5, 7);
            const isIncome = exp.type === 'income';
            return (
              <div
                key={exp.id}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}
                >
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{exp.description}</p>
                  <p className="text-slate-500 text-xs">
                    {exp.category} · {day}/{month}
                  </p>
                </div>
                <span
                  className={`font-semibold text-sm whitespace-nowrap ${
                    isIncome ? 'text-green-400' : 'text-white'
                  }`}
                >
                  {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
