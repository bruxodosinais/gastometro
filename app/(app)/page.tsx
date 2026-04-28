'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, LogOut, Plus } from 'lucide-react';
import { getExpenses, getBudgets, getRecurringExpenses, getMonthlyPlan } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import {
  calculateTotalByType,
  formatCurrency,
  getCategoryAlerts,
  getMonthKey,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import { Budget, CategorySummary, Expense, MonthlyPlan, RecurringExpense } from '@/lib/types';
import dynamic from 'next/dynamic';
import PlanningSection from '@/components/PlanningSection';

const SpendingDonut = dynamic(() => import('@/components/SpendingDonut'), { ssr: false });
const MonthlyBars = dynamic(() => import('@/components/MonthlyBars'), { ssr: false });

export default function HomePage() {
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([getExpenses(), getBudgets(), getRecurringExpenses()]).then(([exp, bud, rec]) => {
      setExpenses(exp);
      setBudgets(bud);
      setRecurringExpenses(rec);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    getMonthlyPlan(period).then(setMonthlyPlan);
  }, [period]);

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

  const fixedCosts = recurringExpenses
    .filter((r) => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  // ── Insights ────────────────────────────────────────────────────────────────
  const now = new Date();
  const isCurrentMonth = period === getMonthKey(now);
  const [periodYear, periodMonth] = period.split('-').map(Number);
  const totalDaysInMonth = new Date(periodYear, periodMonth, 0).getDate();
  const todayDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;
  const daysElapsed = Math.max(isCurrentMonth ? todayDay : totalDaysInMonth, 1);
  const daysRemaining = isCurrentMonth ? totalDaysInMonth - todayDay : 0;

  // Card 1 — ritmo diário disponível
  const dailyAvailable = isCurrentMonth && daysRemaining > 0 ? balance / daysRemaining : null;
  const dailySpent = spent / totalDaysInMonth;

  // Card 2 — projeção de fechamento
  const projectedSpending = isCurrentMonth && spent > 0
    ? (spent / daysElapsed) * totalDaysInMonth
    : spent;
  const projectedOverBudget = income > 0 && projectedSpending > income;

  // Card 3 — vs mês anterior (% + valor absoluto)  — declarado antes de projectionStatus
  const prevDate = new Date(periodYear, periodMonth - 2, 15);
  const prevPeriod = getMonthKey(prevDate);
  const prevSpent = calculateTotalByType(
    expenses.filter((e) => e.date.slice(0, 7) === prevPeriod),
    'expense'
  );
  const spentChange = prevSpent > 0 ? ((spent - prevSpent) / prevSpent) * 100 : null;
  const spentDiff = spentChange !== null ? spent - prevSpent : null;

  // Status da projeção (usa prevSpent — deve vir depois)
  type ProjStatus = 'ok' | 'warning' | 'over';
  const projectionStatus: ProjStatus | null =
    !isCurrentMonth || spent === 0
      ? null
      : projectedOverBudget
      ? 'over'
      : (income > 0 && projectedSpending > income * 0.85) ||
        (prevSpent > 0 && projectedSpending > prevSpent * 1.2)
      ? 'warning'
      : 'ok';

  // Card 4 — maior gasto individual + % do total
  const biggestExpense = periodExpenses.reduce<Expense | null>(
    (max, e) => (!max || e.amount > max.amount ? e : max),
    null
  );
  const biggestPct = biggestExpense && spent > 0
    ? (biggestExpense.amount / spent) * 100
    : null;

  // Card 5 — sobra prevista
  const projectedSurplus = income - projectedSpending;

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white md:hidden">GastôMetro</h1>
          <h1 className="text-2xl font-bold text-white hidden md:block">Dashboard</h1>
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

      {/* Cards: Saldo + Ganhos + Gastos */}
      {/* Mobile: Saldo em cima, Ganhos/Gastos em 2 colunas */}
      {/* Desktop: 3 colunas em linha */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div
          className={`col-span-2 md:col-span-1 rounded-2xl p-5 border ${
            balance >= 0
              ? 'bg-blue-500/5 border-blue-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}
        >
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Saldo
          </p>
          <p className={`text-4xl font-bold ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))}
          </p>
        </div>

        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 md:p-5">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Ganhos
          </p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(income)}</p>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 md:p-5">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Gastos
          </p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(spent)}</p>
        </div>
      </div>

      {/* ── Insights: 5 cards compactos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">

        {/* Card 1 — Ritmo diário disponível */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">
            {isCurrentMonth && daysRemaining > 0 ? 'Ritmo diário disponível' : 'Gasto médio por dia'}
          </p>
          {isCurrentMonth && dailyAvailable !== null ? (
            <>
              <p className={`text-xl font-bold ${dailyAvailable < 0 ? 'text-red-400' : 'text-white'}`}>
                {dailyAvailable < 0
                  ? `−${formatCurrency(Math.abs(dailyAvailable))}`
                  : `${formatCurrency(dailyAvailable)}/dia`}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {dailyAvailable < 0
                  ? 'saldo negativo — ritmo excedido'
                  : `${daysRemaining} dias restantes no mês`}
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-white">{formatCurrency(dailySpent)}/dia</p>
              <p className="text-slate-500 text-xs mt-1">
                {isCurrentMonth ? 'último dia do mês' : 'média real do período'}
              </p>
            </>
          )}
        </div>

        {/* Card 2 — Previsão de fechamento + status */}
        <div className={`rounded-2xl p-4 border ${
          projectionStatus === 'over'
            ? 'bg-red-500/5 border-red-500/20'
            : projectionStatus === 'warning'
            ? 'bg-yellow-500/5 border-yellow-500/20'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">
            {isCurrentMonth ? 'Previsão do mês' : 'Total do mês'}
          </p>
          <p className={`text-xl font-bold ${
            projectionStatus === 'over'
              ? 'text-red-400'
              : projectionStatus === 'warning'
              ? 'text-yellow-400'
              : 'text-white'
          }`}>
            {formatCurrency(projectedSpending)}
          </p>
          <p className={`text-xs mt-1 font-medium ${
            projectionStatus === 'over'
              ? 'text-red-400/80'
              : projectionStatus === 'warning'
              ? 'text-yellow-400/80'
              : projectionStatus === 'ok'
              ? 'text-green-400/80'
              : 'text-slate-500'
          }`}>
            {projectionStatus === 'over'
              ? 'Acima da média'
              : projectionStatus === 'warning'
              ? 'Atenção'
              : projectionStatus === 'ok'
              ? 'Dentro do esperado'
              : !isCurrentMonth
              ? 'gasto real do período'
              : 'nenhum gasto registrado ainda'}
          </p>
        </div>

        {/* Card 3 — vs mês anterior: % + valor absoluto */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">
            vs mês anterior
          </p>
          {spentChange === null ? (
            <>
              <p className="text-xl font-bold text-slate-500">—</p>
              <p className="text-slate-600 text-xs mt-1">sem dados do mês anterior</p>
            </>
          ) : (
            <>
              <p className={`text-xl font-bold ${spentChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {spentChange > 0 ? '+' : ''}{Math.round(spentChange)}%{' '}
                <span className="text-sm font-semibold opacity-80">
                  ({spentDiff! > 0 ? '+' : ''}{formatCurrency(spentDiff!)})
                </span>
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {formatCurrency(prevSpent)} em {getMonthLabel(prevPeriod)}
              </p>
            </>
          )}
        </div>

        {/* Card 4 — Maior gasto + % do total */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">
            Maior gasto do mês
          </p>
          {biggestExpense ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{CATEGORY_CONFIG[biggestExpense.category].icon}</span>
                <p className="text-xl font-bold text-white">{formatCurrency(biggestExpense.amount)}</p>
              </div>
              <p className="text-slate-500 text-xs mt-1 truncate">{biggestExpense.description}</p>
              {biggestPct !== null && (
                <p className="text-slate-600 text-xs mt-0.5">
                  {Math.round(biggestPct)}% dos gastos do mês
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-500">—</p>
              <p className="text-slate-600 text-xs mt-1">nenhum gasto ainda</p>
            </>
          )}
        </div>

        {/* Card 5 — Sobra prevista (ocupa linha inteira no desktop) */}
        <div className={`md:col-span-2 rounded-2xl p-4 border ${
          projectedSurplus >= 0
            ? 'bg-green-500/5 border-green-500/20'
            : 'bg-red-500/5 border-red-500/20'
        }`}>
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">
            Sobra prevista
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <p className={`text-2xl font-bold ${projectedSurplus >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {projectedSurplus >= 0 ? '' : '−'}{formatCurrency(Math.abs(projectedSurplus))}
            </p>
            <p className="text-slate-500 text-xs mb-0.5">
              {income > 0
                ? `receita ${formatCurrency(income)} − previsão ${formatCurrency(projectedSpending)}`
                : 'sem receita registrada no período'}
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos: empilhados no mobile, lado a lado no desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-slate-200 font-semibold text-sm mb-4">Gastos por Categoria</h2>
          <SpendingDonut entries={periodEntries} />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-slate-200 font-semibold text-sm mb-4">Evolução — últimos 6 meses</h2>
          <MonthlyBars allExpenses={expenses} currentPeriod={period} />
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              Ganhos
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Gastos
            </div>
          </div>
        </div>
      </div>

      {/* Planejamento mensal */}
      <PlanningSection
        period={period}
        income={income}
        spent={spent}
        fixedCosts={fixedCosts}
        budgets={budgets}
        periodExpenses={periodExpenses}
        monthlyPlan={monthlyPlan}
        onPlanUpdate={setMonthlyPlan}
      />

      {/* No desktop: alertas e movimentações lado a lado */}
      <div className="md:grid md:grid-cols-[1fr_420px] md:gap-6 md:items-start">
        {/* Coluna esquerda: últimas movimentações */}
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

        {/* Coluna direita: alertas */}
        <div className="mt-4 md:mt-0 space-y-4">
          {alerts.length > 0 && (
            <section>
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

          {budgetAlerts.length > 0 && (
            <section>
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
        </div>
      </div>

      {/* Botão flutuante — oculto no desktop (sidebar já tem "Lançar") */}
      <Link
        href="/lancamentos"
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-14 h-14 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center shadow-xl shadow-violet-900/60 transition-colors z-40 md:hidden"
      >
        <Plus size={26} className="text-white" />
      </Link>
    </main>
  );
}
