'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, LogOut, Plus } from 'lucide-react';
import { getExpenses, getBudgets } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import {
  calculateTotalByType,
  formatCurrency,
  getCategoryAlerts,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import { Budget, CategorySummary, Expense } from '@/lib/types';

export default function HomePage() {
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([getExpenses(), getBudgets()]).then(([exp, bud]) => {
      setExpenses(exp);
      setBudgets(bud);
      setReady(true);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const periodEntries = expenses.filter((e) => e.date.slice(0, 7) === period);
  const income = calculateTotalByType(periodEntries, 'income');
  const spent = calculateTotalByType(periodEntries, 'expense');
  const balance = income - spent;

  const alerts: CategorySummary[] = getCategoryAlerts(expenses, period).filter(
    (a) => a.isAlert
  );

  const periodExpenses = periodEntries.filter((e) => e.type === 'expense');
  const budgetAlerts = budgets
    .map((b) => {
      const total = periodExpenses
        .filter((e) => e.category === b.category)
        .reduce((sum, e) => sum + e.amount, 0);
      return { category: b.category, total, budget: b.amount, pct: (total / b.amount) * 100 };
    })
    .filter((b) => b.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  const recent = [...periodEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">GastôMetro</h1>
          <p className="text-slate-400 text-sm capitalize">{getMonthLabel(period)}</p>
        </div>
        <button
          onClick={handleLogout}
          title="Sair"
          className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Seletor de período */}
      <PeriodSelector />

      {/* Card Saldo */}
      <div
        className={`rounded-2xl p-5 mb-3 border ${
          balance >= 0
            ? 'bg-blue-500/5 border-blue-500/20'
            : 'bg-red-500/5 border-red-500/20'
        }`}
      >
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
          Saldo
        </p>
        <p
          className={`text-4xl font-bold ${
            balance >= 0 ? 'text-blue-400' : 'text-red-400'
          }`}
        >
          {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))}
        </p>
      </div>

      {/* Cards Ganhos + Gastos */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Ganhos
          </p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(income)}</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Gastos
          </p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(spent)}</p>
        </div>
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

      {/* Alertas de Budget */}
      {budgetAlerts.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-violet-400" />
            <h2 className="text-slate-200 font-semibold text-sm">Alertas de Orçamento</h2>
          </div>
          <div className="space-y-2">
            {budgetAlerts.map((alert) => {
              const cfg = CATEGORY_CONFIG[alert.category];
              const barColor = alert.pct > 100 ? 'bg-red-500' : 'bg-yellow-500';
              return (
                <div
                  key={alert.category}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cfg.icon}</span>
                      <span className="text-white font-medium text-sm">{alert.category}</span>
                    </div>
                    <span className={`font-bold text-sm ${alert.pct > 100 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {Math.round(alert.pct)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>{formatCurrency(alert.total)} gasto</span>
                    <span>limite: {formatCurrency(alert.budget)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(alert.pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Últimas movimentações */}
      <section>
        <h2 className="text-slate-200 font-semibold text-sm mb-2">Últimas Movimentações</h2>
        {recent.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">Nenhum lançamento neste período</p>
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
