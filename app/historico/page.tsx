'use client';

import { useEffect, useState } from 'react';
import { getExpenses } from '@/lib/storage';
import {
  calculateTotal,
  formatCurrency,
  getLastMonths,
  getMonthKey,
  getMonthLabel,
  groupByMonth,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { Expense } from '@/lib/types';

export default function HistoricoPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeMonth, setActiveMonth] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const all = getExpenses();
    setExpenses(all);
    const current = getMonthKey(new Date());
    const months = getLastMonths(all, current, 3);
    setActiveMonth(months[0] ?? current);
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const currentMonth = getMonthKey(new Date());
  const months = getLastMonths(expenses, currentMonth, 3);
  const grouped = groupByMonth(expenses);

  const activeExpenses = [...(grouped[activeMonth] ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const activeTotal = calculateTotal(activeExpenses);

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Histórico</h1>
      <p className="text-slate-400 text-sm mb-6">Últimos 3 meses</p>

      {/* Abas de meses */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {months.map((month) => {
          const label = getMonthLabel(month);
          const labelShort = label.split(' ')[0]; // só o nome do mês
          const labelCap = labelShort.charAt(0).toUpperCase() + labelShort.slice(1);
          const year = month.slice(0, 4);
          const active = activeMonth === month;
          const monthTotal = calculateTotal(grouped[month] ?? []);

          return (
            <button
              key={month}
              onClick={() => setActiveMonth(month)}
              className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-left transition-all border ${
                active
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-semibold leading-none mb-0.5">
                {labelCap} {year}
              </p>
              <p className={`text-sm font-bold ${active ? 'text-violet-200' : 'text-slate-300'}`}>
                {formatCurrency(monthTotal)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Total do mês selecionado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total</p>
        <p className="text-3xl font-bold text-white">{formatCurrency(activeTotal)}</p>
        <p className="text-slate-500 text-xs mt-1 capitalize">{getMonthLabel(activeMonth)}</p>
      </div>

      {/* Lista de lançamentos */}
      {activeExpenses.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">
          Nenhum lançamento neste período
        </p>
      ) : (
        <div className="space-y-2">
          {activeExpenses.map((exp) => {
            const cfg = CATEGORY_CONFIG[exp.category];
            const day = exp.date.slice(8, 10);
            const month = exp.date.slice(5, 7);
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
                <span className="text-white font-semibold text-sm whitespace-nowrap">
                  {formatCurrency(exp.value)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
