'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { getExpenses } from '@/lib/storage';
import {
  calculateTotal,
  formatCurrency,
  getCategoryAlerts,
  getMonthKey,
  getMonthLabel,
  groupByMonth,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { CategorySummary, Expense } from '@/lib/types';

export default function HomePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setExpenses(getExpenses());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const now = new Date();
  const currentMonth = getMonthKey(now);
  const monthLabel = getMonthLabel(currentMonth);

  const grouped = groupByMonth(expenses);
  const currentExpenses = grouped[currentMonth] ?? [];
  const currentTotal = calculateTotal(currentExpenses);

  const prevMonths = Object.keys(grouped).filter((m) => m < currentMonth).sort();
  const prevAverage =
    prevMonths.length > 0
      ? prevMonths.reduce((sum, m) => sum + calculateTotal(grouped[m] ?? []), 0) /
        prevMonths.length
      : 0;

  const alerts: CategorySummary[] = getCategoryAlerts(expenses, currentMonth).filter(
    (a) => a.isAlert
  );

  const recent = [...currentExpenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const diff = prevAverage > 0 ? ((currentTotal - prevAverage) / prevAverage) * 100 : 0;

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">GastôMetro</h1>
          <p className="text-slate-400 text-sm capitalize">{monthLabel}</p>
        </div>
        <div className="w-11 h-11 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xl">
          📊
        </div>
      </div>

      {/* Card total do mês */}
      <div className="bg-slate-900 rounded-2xl p-5 mb-4 border border-slate-800">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
          Total do mês
        </p>
        <p className="text-4xl font-bold text-white mb-3">{formatCurrency(currentTotal)}</p>

        {prevAverage > 0 && (
          <div className="flex items-center gap-2">
            {diff > 10 ? (
              <TrendingUp size={14} className="text-red-400" />
            ) : diff < -10 ? (
              <TrendingDown size={14} className="text-green-400" />
            ) : null}
            <p className="text-slate-500 text-sm">
              Média mensal:{' '}
              <span className="text-slate-300">{formatCurrency(prevAverage)}</span>
              {Math.abs(diff) > 5 && (
                <span
                  className={`ml-2 text-xs font-semibold ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}
                >
                  {diff > 0 ? '+' : ''}
                  {Math.round(diff)}%
                </span>
              )}
            </p>
          </div>
        )}

        {prevAverage > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  diff > 20 ? 'bg-red-500' : diff > 0 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((currentTotal / (prevAverage * 1.5)) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Alertas de desperdício */}
      {alerts.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-amber-400" />
            <h2 className="text-slate-200 font-semibold text-sm">Alertas de Desperdício</h2>
          </div>
          <div className="space-y-2">
            {alerts.map((alert) => {
              const cfg = CATEGORY_CONFIG[alert.category];
              return (
                <div
                  key={alert.category}
                  className={`rounded-xl p-4 border ${cfg.bgClass} ${cfg.borderClass}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cfg.icon}</span>
                      <span className="text-white font-medium text-sm">{alert.category}</span>
                    </div>
                    <span className="text-red-400 font-bold text-sm">
                      +{Math.round(alert.percentChange)}%
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    {formatCurrency(alert.total)} gasto · média:{' '}
                    {formatCurrency(alert.average)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Últimos lançamentos */}
      <section>
        <h2 className="text-slate-200 font-semibold text-sm mb-2">Últimos Lançamentos</h2>
        {recent.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">Nenhum gasto lançado este mês</p>
            <Link href="/lancamentos" className="text-violet-400 text-sm mt-2 inline-block">
              Lançar agora →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((exp) => {
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
      </section>

      {/* Botão flutuante */}
      <Link
        href="/lancamentos"
        className="fixed bottom-20 right-4 w-14 h-14 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center shadow-xl shadow-violet-900/60 transition-colors z-40"
      >
        <Plus size={26} className="text-white" />
      </Link>
    </main>
  );
}
