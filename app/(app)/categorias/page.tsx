'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, Minus, Pencil, Check, X, Trash2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getExpenses, getBudgets, upsertBudget, deleteBudget } from '@/lib/storage';
import {
  formatCurrency,
  getCategoryAlerts,
  getMonthLabel,
  groupByMonth,
  calculateByCategory,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import { Budget, CategorySummary, Expense, ExpenseCategory } from '@/lib/types';

type InsightItem = { text: string; variant: 'above' | 'below' | 'neutral' };

function shortLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1);
  return d
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function getLast6Months(currentMonth: string): string[] {
  const [y, m] = currentMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

type TooltipPayload = { name: string; value: number; color: string };

function CategoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function CategoriasPage() {
  const { period } = usePeriod();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ready, setReady] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const insightCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([getExpenses(), getBudgets()]).then(([exp, bud]) => {
      setExpenses(exp);
      setBudgets(bud);
      setReady(true);
    });
  }, []);

  const budgetMap = Object.fromEntries(
    budgets.map((b) => [b.category, b.amount])
  ) as Record<ExpenseCategory, number | undefined>;

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

  // All data computations — guarded so they return empty when not ready
  const summaries: CategorySummary[] = ready ? getCategoryAlerts(expenses, period) : [];
  const maxTotal = Math.max(...summaries.map((s) => Math.max(s.total, s.average)), 1);

  const rankedSummaries = [...summaries]
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);
  const totalGasto = rankedSummaries.reduce((sum, s) => sum + s.total, 0);
  const maxRankTotal = rankedSummaries[0]?.total ?? 1;

  const top3 = [...summaries]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .filter((s) => s.total > 0)
    .map((s) => s.category);

  const last6Months = ready ? getLast6Months(period) : [];
  const groupedExpenses = ready
    ? groupByMonth(expenses.filter((e) => e.type === 'expense'))
    : {};
  const chartData = last6Months.map((month) => {
    const byCategory = calculateByCategory(groupedExpenses[month] ?? []);
    const entry: Record<string, string | number> = { month: shortLabel(month) };
    top3.forEach((cat) => { entry[cat] = byCategory[cat] ?? 0; });
    return entry;
  });
  const hasChartData =
    top3.length > 0 && chartData.some((d) => top3.some((cat) => (d[cat] as number) > 0));

  // Tendência da categoria principal para contexto do gráfico
  let chartTrendText = '';
  if (top3.length > 0 && hasChartData) {
    const topCat = top3[0];
    const vals = chartData.map((d) => d[topCat] as number);
    const last3 = vals.slice(-3);
    const isRising = last3[2] > last3[1] && last3[1] > last3[0];
    const isFalling = last3[2] < last3[1] && last3[1] < last3[0];
    if (isRising) chartTrendText = `${topCat} teve alta recente`;
    else if (isFalling) chartTrendText = `${topCat} caiu nos últimos meses`;
    else chartTrendText = `${topCat} permanece estável`;
  }

  // Insight fixo: prioridade → acima da média → maior participação → abaixo da média
  const mostAbove = [...summaries]
    .filter((s) => s.total > 0 && s.average > 0 && s.percentChange > 5)
    .sort((a, b) => b.percentChange - a.percentChange)[0];

  const topByShare = [...summaries]
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)[0];

  const mostBelow = [...summaries]
    .filter((s) => s.total > 0 && s.average > 0 && s.percentChange < -5)
    .sort((a, b) => a.percentChange - b.percentChange)[0];

  const currentInsight: InsightItem | null = mostAbove
    ? {
        text: `⚠️ ${mostAbove.category} está ${Math.round(mostAbove.percentChange)}% acima da média`,
        variant: 'above',
      }
    : topByShare && totalGasto > 0
    ? {
        text: `🔥 ${topByShare.category} representa ${Math.round((topByShare.total / totalGasto) * 100)}% dos gastos`,
        variant: 'neutral',
      }
    : mostBelow
    ? {
        text: `✅ ${mostBelow.category} está ${Math.round(Math.abs(mostBelow.percentChange))}% abaixo da média`,
        variant: 'below',
      }
    : null;

  const insightBgClass = !currentInsight
    ? 'bg-slate-800/50 border border-slate-700'
    : currentInsight.variant === 'above'
    ? 'bg-red-500/20 border border-red-500/30'
    : currentInsight.variant === 'below'
    ? 'bg-green-500/20 border border-green-500/30'
    : 'bg-yellow-500/20 border border-yellow-500/30';

  const insightTextClass = !currentInsight
    ? 'text-slate-400'
    : currentInsight.variant === 'above'
    ? 'text-red-400'
    : currentInsight.variant === 'below'
    ? 'text-green-400'
    : 'text-yellow-400';

  // Categoria do insight: sincroniza destaque do card com o insight exibido
  const insightCategory: ExpenseCategory | null =
    mostAbove?.category ?? topByShare?.category ?? mostBelow?.category ?? null;

  // Scroll suave para o card do insight após carregar
  useEffect(() => {
    if (!ready || !insightCategory) return;
    const timer = setTimeout(() => {
      insightCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(timer);
  }, [ready, insightCategory]);

  // Early return for loading state — placed after all hooks
  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Categorias</h1>
      <p className="text-slate-400 text-sm capitalize mb-5">{getMonthLabel(period)}</p>

      <PeriodSelector />

      {/* Insight principal */}
      <div
        className={`rounded-xl px-5 py-4 mb-6 cursor-pointer hover:opacity-90 transition-opacity duration-150 ease-out ${insightBgClass}`}
        onClick={() =>
          insightCategory &&
          router.push(`/historico?categoria=${encodeURIComponent(insightCategory)}`)
        }
      >
        <p className={`text-lg font-semibold ${insightTextClass}`}>
          {currentInsight
            ? currentInsight.text
            : 'Sem dados suficientes para gerar insights'}
        </p>
      </div>

      {/* Ranking de categorias do mês */}
      {rankedSummaries.length > 0 && (
        <div className="opacity-[0.85] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-5">
          <h2 className="text-white font-semibold text-sm mb-3">Ranking do mês</h2>
          <div className="space-y-2.5">
            {rankedSummaries.map((s, i) => {
              const cfg = CATEGORY_CONFIG[s.category];
              const barWidth = (s.total / maxRankTotal) * 100;
              const pct = totalGasto > 0 ? (s.total / totalGasto) * 100 : 0;
              return (
                <div key={s.category} className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs w-4 text-right font-medium shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-base w-6 text-center shrink-0">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-xs font-medium truncate">
                        {s.category}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-xs font-semibold ${cfg.textClass}`}>
                          {formatCurrency(s.total)}
                        </span>
                        <span className="text-slate-500 text-xs w-7 text-right">
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 brightness-90 ${cfg.barClass}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs">
            <span className="text-slate-500">Total gasto no mês</span>
            <span className="text-slate-200 font-semibold">{formatCurrency(totalGasto)}</span>
          </div>
        </div>
      )}

      {/* Legenda barras */}
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

      {/* Cards de categorias */}
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        {summaries.map((summary) => {
          const cfg = CATEGORY_CONFIG[summary.category];
          const currentWidth = (summary.total / maxTotal) * 100;
          const avgWidth = (summary.average / maxTotal) * 100;
          const hasData = summary.total > 0 || summary.average > 0;
          const budget = budgetMap[summary.category];
          const budgetPct = budget != null && budget > 0 ? (summary.total / budget) * 100 : null;
          const isEditing = editingCategory === summary.category;
          const isDominant = summary.category === insightCategory;

          let budgetBarColor = 'bg-green-500';
          if (budgetPct != null) {
            if (budgetPct > 100) budgetBarColor = 'bg-red-500';
            else if (budgetPct >= 80) budgetBarColor = 'bg-yellow-500';
          }

          const hasTrend = summary.average > 0;
          const trendUp = hasTrend && summary.percentChange > 5;
          const trendDown = hasTrend && summary.percentChange < -5;

          const budgetAlertLevel =
            budget != null && budgetPct != null && !isEditing
              ? budgetPct >= 100
                ? 'over'
                : budgetPct >= 80
                ? 'warn'
                : null
              : null;

          const cardBaseClass = `bg-slate-900 rounded-2xl p-4 transition-all duration-200 ease-out`;
          const cardBorderClass = isDominant
            ? 'border border-red-500/60 shadow-[0_0_18px_rgba(239,68,68,0.35)] shadow-lg transform scale-[1.05]'
            : summary.isAlert
            ? 'border border-red-500/30'
            : 'border border-slate-800';

          return (
            <div
              key={summary.category}
              ref={isDominant ? insightCardRef : null}
              className={`${cardBaseClass} ${cardBorderClass}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${cfg.bgClass}`}
                  >
                    {cfg.icon}
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">{summary.category}</p>
                    {summary.isAlert && (
                      <p className="text-red-400 text-xs font-medium">⚠ Acima do normal</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Badge alerta de orçamento */}
                  {budgetAlertLevel === 'over' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 leading-tight">
                      🔴 Limite
                    </span>
                  )}
                  {budgetAlertLevel === 'warn' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 leading-tight">
                      ⚠️ 80%
                    </span>
                  )}

                  {/* Indicador de tendência */}
                  {hasTrend && (
                    <div
                      className={`flex items-center gap-0.5 text-xs font-semibold ${
                        trendUp
                          ? 'text-red-400'
                          : trendDown
                          ? 'text-green-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {trendUp ? (
                        <ArrowUp size={12} />
                      ) : trendDown ? (
                        <ArrowDown size={12} />
                      ) : (
                        <Minus size={12} />
                      )}
                      {Math.round(Math.abs(summary.percentChange))}%
                    </div>
                  )}

                  <button
                    onClick={() => (isEditing ? cancelEdit() : openEdit(summary.category))}
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
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        R$
                      </span>
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
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">
                        Planejado
                      </p>
                      <p className="text-slate-300 font-semibold text-sm">
                        {formatCurrency(budget)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">
                        Gasto atual
                      </p>
                      <p
                        className={`font-bold text-sm ${
                          budgetPct! > 100
                            ? 'text-red-400'
                            : budgetPct! >= 80
                            ? 'text-yellow-400'
                            : 'text-green-400'
                        }`}
                      >
                        {formatCurrency(summary.total)}{' '}
                        <span className="text-xs font-medium opacity-80">
                          ({Math.round(budgetPct!)}%)
                        </span>
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
                    <p className="text-red-400 text-xs mt-1 font-medium">
                      🚨 Limite ultrapassado em {formatCurrency(summary.total - budget)}
                    </p>
                  )}
                  {budgetPct! >= 80 && budgetPct! <= 100 && (
                    <p className="text-yellow-400 text-xs mt-1 font-medium">
                      ⚠ Restam {formatCurrency(budget - summary.total)}
                    </p>
                  )}
                </div>
              )}

              {!hasData && !isEditing && budget == null && (
                <p className="text-slate-600 text-xs">Sem lançamentos nesta categoria</p>
              )}

              {/* Micro ações */}
              {hasData && !isEditing && (
                <div className="flex gap-3 mt-2">
                  {trendUp ? (
                    <>
                      <span
                        className="text-xs text-slate-400 hover:text-white cursor-pointer transition-colors duration-150 ease-out"
                        onClick={() =>
                          router.push(`/historico?categoria=${encodeURIComponent(summary.category)}`)
                        }
                      >
                        Ver gastos
                      </span>
                      <span
                        className="text-xs text-slate-400 hover:text-white cursor-pointer transition-colors duration-150 ease-out"
                        onClick={() => console.log('ajustar-meta', summary.category)}
                      >
                        Reduzir meta
                      </span>
                    </>
                  ) : (
                    <span
                      className="text-xs text-slate-400 hover:text-white cursor-pointer transition-colors duration-150 ease-out"
                      onClick={() =>
                        router.push(`/historico?categoria=${encodeURIComponent(summary.category)}`)
                      }
                    >
                      Ver histórico
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Evolução por categoria — últimos 6 meses */}
      {hasChartData && (
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h2 className="text-white font-semibold text-sm mb-0.5">Evolução por categoria</h2>
          <p className="text-slate-500 text-xs mb-1">Top 3 categorias — últimos 6 meses</p>
          {chartTrendText && (
            <p className="text-xs text-slate-400 mb-2">{chartTrendText}</p>
          )}
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%" minHeight={0}>
              <BarChart data={chartData} barCategoryGap="28%" barGap={3}>
                <CartesianGrid vertical={false} stroke="#1e293b" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<CategoryTooltip />} cursor={{ fill: '#ffffff08' }} />
                {top3.map((cat) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    fill={CATEGORY_CONFIG[cat].color}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 justify-center flex-wrap">
            {top3.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: CATEGORY_CONFIG[cat].color }}
                />
                <span className="text-slate-400 text-xs">{cat}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
