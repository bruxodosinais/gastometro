'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Pencil, Check, X, Trash2, ChevronDown } from 'lucide-react';
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
// CATEGORY_CONFIG aqui é OK: o ranking e o detalhamento iteram só
// EXPENSE_CATEGORIES (categorias fixas), via getCategoryAlerts. Custom
// categories vivem na seção "Minhas categorias" mais abaixo (V-02 #7).
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import MyCategoriesSection from './_components/MyCategoriesSection';
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

function getRankingBarColor(category: string): string {
  const map: Record<string, string> = {
    'Moradia': 'var(--accent)',
    'Alimentação': 'var(--green)',
    'Outros': 'var(--text-3)',
    'Assinaturas': 'var(--red)',
    'Saúde': '#FF9A9A',
    'Educação': '#4ECDC4',
    'Lazer': 'var(--yellow)',
    'Delivery': '#FF8C42',
    'Transporte': 'var(--accent)',
  };
  return map[category] ?? 'var(--text-3)';
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
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 600 }}>
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
  const [expandedCategory, setExpandedCategory] = useState<ExpenseCategory | null>(null);

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

  const insightCategory: ExpenseCategory | null =
    mostAbove?.category ?? topByShare?.category ?? mostBelow?.category ?? null;

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </main>
    );
  }

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">

      {/* Header */}
      <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)', marginBottom: 4 }}>
        Categorias
      </h1>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 20 }}>
        {getMonthLabel(period)}
      </p>

      <PeriodSelector />

      {/* Alerta de anomalia / Insight principal */}
      {currentInsight && (
        <div
          className="cursor-pointer transition-opacity hover:opacity-90 mb-6"
          onClick={() =>
            insightCategory &&
            router.push(`/historico?categoria=${encodeURIComponent(insightCategory)}`)
          }
          style={
            currentInsight.variant === 'above'
              ? {
                  background: 'var(--red-bg)',
                  border: '1px solid rgba(255,71,87,0.2)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                }
              : currentInsight.variant === 'below'
              ? {
                  background: 'var(--green-bg)',
                  border: '1px solid rgba(0,195,122,0.2)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                }
              : {
                  background: 'var(--accent-bg)',
                  border: '1px solid var(--accent-soft)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                }
          }
        >
          <p
            style={{
              fontSize: 13, fontWeight: 700,
              color:
                currentInsight.variant === 'above'
                  ? 'var(--red)'
                  : currentInsight.variant === 'below'
                  ? 'var(--green-text)'
                  : 'var(--accent)',
            }}
          >
            {currentInsight.text}
          </p>
        </div>
      )}

      {/* Ranking do mês */}
      {rankedSummaries.length > 0 && (
        <div
          className="mb-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px' }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Ranking do mês</p>
          <div className="space-y-3">
            {rankedSummaries.map((s, i) => {
              const cfg = CATEGORY_CONFIG[s.category];
              const barWidth = (s.total / maxRankTotal) * 100;
              const pct = totalGasto > 0 ? (s.total / totalGasto) * 100 : 0;
              const barColor = getRankingBarColor(s.category);
              return (
                <div key={s.category} className="flex items-center gap-3">
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{cfg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }} className="truncate">
                        {s.category}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span style={{ fontSize: 12, fontWeight: 800, color: barColor }}>
                          {formatCurrency(s.total)}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', width: 28, textAlign: 'right' }}>
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{ height: '100%', borderRadius: 2, background: barColor, width: `${barWidth}%`, transition: 'all 0.5s' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Total gasto no mês</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(totalGasto)}</span>
          </div>
        </div>
      )}

      {rankedSummaries.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-5xl mb-3">📊</p>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Nenhum gasto registrado ainda</p>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20, maxWidth: 280, margin: '0 auto 20px' }}>
            Quando você lançar gastos, verá aqui como está distribuindo seu dinheiro por categoria.
          </p>
          <button
            onClick={() => router.push('/lancamentos')}
            className="transition-opacity hover:opacity-80 active:scale-95"
            style={{
              background: 'var(--accent)', color: '#fff', borderRadius: 'var(--r-sm)',
              padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Lançar gasto
          </button>
        </div>
      ) : (
        <>
          {/* Legenda */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>Mês atual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--text-3)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>Média anterior</span>
            </div>
          </div>

          {/* Cards de categorias */}
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {summaries.map((summary) => {
              const cfg = CATEGORY_CONFIG[summary.category];
              const currentWidth = maxTotal > 0 ? (summary.total / maxTotal) * 100 : 0;
              const avgWidth = maxTotal > 0 ? (summary.average / maxTotal) * 100 : 0;
              const hasData = summary.total > 0 || summary.average > 0;
              const budget = budgetMap[summary.category];
              const budgetPct = budget != null && budget > 0 ? (summary.total / budget) * 100 : null;
              const isEditing = editingCategory === summary.category;

              // trendUp serve só pra escolher as micro-ações do expandido
              // ("Ver gastos" + "Reduzir meta" vs "Ver histórico"). Tendência
              // histórica não vai mais na linha collapsed — lá mostramos % do
              // limite. A linha "Atual vs Média" do expandido segue exibindo a
              // média; nada do bloco trend aparece na linha principal.
              const trendUp = summary.average > 0 && summary.percentChange > 5;

              // Cor do valor é orientada ao orçamento, não à média histórica:
              // sem limite definido (ou limite zero), exibe neutro — a média é
              // referência, mas não "aprova"/"reprova" o gasto. Só vai vermelho
              // quando spent > budget > 0; verde só quando há budget e ele
              // segura o gasto.
              const currentColor =
                budget == null || budget <= 0
                  ? 'var(--text)'
                  : summary.total > budget
                  ? 'var(--red)'
                  : 'var(--green)';
              const isExpanded = expandedCategory === summary.category;

              return (
                <div
                  key={summary.category}
                  style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--r)',
                    padding: '14px 16px',
                    transition: 'all 0.2s ease-out',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Linha compacta clicável */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) return;
                      setExpandedCategory((curr) =>
                        curr === summary.category ? null : summary.category
                      );
                    }}
                    aria-expanded={isExpanded}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: 'Nunito, sans-serif',
                      textAlign: 'left',
                    }}
                  >
                    <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: 'var(--logo-bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {cfg.icon}
                      </div>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {summary.category}
                      </p>
                    </div>

                    <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: currentColor }}>
                        {formatCurrency(summary.total)}
                      </span>
                      {budgetPct != null && (
                        <span
                          className="flex items-center gap-0.5"
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: budgetPct > 100 ? 'var(--red)' : 'var(--green)',
                          }}
                        >
                          <ArrowUp size={12} />
                          {Math.round(budgetPct)}%
                        </span>
                      )}
                      <ChevronDown
                        size={16}
                        color="var(--text-3)"
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.25s ease',
                        }}
                      />
                    </div>
                  </button>

                  {(isExpanded || isEditing) && (
                  <div style={{ marginTop: 14 }}>
                  {/* Sub-header com alertas / badges / botão editar */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      {summary.isAlert && (
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', margin: 0 }}>⚠ Acima do normal</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Badge Limite */}
                      {budget != null && !isEditing && (
                        <span
                          style={{
                            fontSize: 10, fontWeight: 700,
                            background: 'var(--red-bg)', color: 'var(--red)',
                            border: '1px solid rgba(255,71,87,0.2)',
                            borderRadius: 4, padding: '2px 6px',
                          }}
                        >
                          Limite
                        </span>
                      )}
                      <button
                        onClick={() => (isEditing ? cancelEdit() : openEdit(summary.category))}
                        className="flex items-center justify-center transition-colors"
                        style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: 'var(--logo-bg)', color: 'var(--text-3)',
                          cursor: 'pointer',
                        }}
                        title="Definir limite mensal"
                      >
                        {isEditing ? <X size={13} /> : <Pencil size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Linha atual vs média */}
                  <div className="flex justify-between mb-2">
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                      Atual:{' '}
                      <span style={{ fontWeight: 700, color: currentColor }}>
                        {formatCurrency(summary.total)}
                      </span>
                    </span>
                    {summary.average > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                        Média:{' '}
                        <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                          {formatCurrency(summary.average)}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Barra dupla */}
                  {hasData && (
                    <div className="space-y-1.5 mb-3">
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{ height: '100%', borderRadius: 4, background: 'var(--green)', width: `${currentWidth}%`, transition: 'all 0.5s' }}
                        />
                      </div>
                      {summary.average > 0 && (
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div
                            style={{ height: '100%', borderRadius: 4, background: 'var(--text-3)', width: `${avgWidth}%`, transition: 'all 0.5s' }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {!hasData && <div className="mb-3" />}

                  {/* Edição de limite */}
                  {isEditing && (
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Limite mensal (R$)
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)', fontSize: 13 }}>
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
                            className="w-full focus:outline-none"
                            style={{
                              background: 'var(--logo-bg)', border: '1px solid var(--border)',
                              borderRadius: 'var(--r-sm)', paddingLeft: 36, paddingRight: 12,
                              paddingTop: 10, paddingBottom: 10,
                              color: 'var(--text)', fontSize: 13,
                            }}
                          />
                        </div>
                        <button
                          onClick={() => saveEdit(summary.category)}
                          disabled={savingBudget}
                          className="flex items-center justify-center transition-opacity disabled:opacity-60"
                          style={{
                            width: 40, height: 40, borderRadius: 'var(--r-sm)',
                            background: 'var(--accent)', cursor: 'pointer',
                          }}
                        >
                          <Check size={16} color="#fff" />
                        </button>
                        {budget != null && (
                          <button
                            onClick={() => removeEdit(summary.category)}
                            disabled={savingBudget}
                            className="flex items-center justify-center transition-colors disabled:opacity-60"
                            style={{
                              width: 40, height: 40, borderRadius: 'var(--r-sm)',
                              background: 'var(--logo-bg)', color: 'var(--text-3)', cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-bg)';
                              (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'var(--logo-bg)';
                              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)';
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Seção planejado */}
                  {!isEditing && budget != null && (
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div className="flex items-end justify-between mb-2">
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                            Planejado
                          </p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                            {formatCurrency(budget)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                            Gasto atual
                          </p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: budgetPct! > 100 ? 'var(--red)' : 'var(--green)' }}>
                            {formatCurrency(summary.total)}{' '}
                            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
                              ({Math.round(budgetPct!)}%)
                            </span>
                          </p>
                        </div>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%', borderRadius: 4, transition: 'all 0.5s',
                            background: budgetPct! > 100 ? 'var(--red)' : 'var(--green)',
                            width: `${Math.min(budgetPct!, 100)}%`,
                          }}
                        />
                      </div>
                      {budgetPct! > 100 && (
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginTop: 6 }}>
                          Limite ultrapassado em {formatCurrency(summary.total - budget)}
                        </p>
                      )}
                      {budgetPct! >= 80 && budgetPct! <= 100 && (
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--yellow)', marginTop: 6 }}>
                          ⚠ Restam {formatCurrency(budget - summary.total)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Estado sem lançamentos */}
                  {!hasData && !isEditing && budget == null && (
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>
                      Sem lançamentos nesta categoria
                    </p>
                  )}

                  {/* Micro ações */}
                  {hasData && !isEditing && (
                    <div className="flex gap-3 mt-2">
                      {trendUp ? (
                        <>
                          <span
                            style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
                            className="hover:opacity-70 transition-opacity"
                            onClick={() => router.push(`/historico?categoria=${encodeURIComponent(summary.category)}`)}
                          >
                            Ver gastos
                          </span>
                          <span
                            style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
                            className="hover:opacity-70 transition-opacity"
                            onClick={() => console.log('ajustar-meta', summary.category)}
                          >
                            Reduzir meta
                          </span>
                        </>
                      ) : (
                        <span
                          style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
                          className="hover:opacity-70 transition-opacity"
                          onClick={() => router.push(`/historico?categoria=${encodeURIComponent(summary.category)}`)}
                        >
                          Ver histórico
                        </span>
                      )}
                    </div>
                  )}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Evolução por categoria — últimos 6 meses */}
      {hasChartData && (
        <div
          className="mt-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px' }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>Evolução por categoria</p>
          <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>Top 3 categorias — últimos 6 meses</p>
          {chartTrendText && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{chartTrendText}</p>
          )}
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%" minHeight={0}>
              <BarChart data={chartData} barCategoryGap="28%" barGap={3}>
                <CartesianGrid vertical={false} stroke="#E8E8E2" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#B4B4AA', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  tick={{ fill: '#B4B4AA', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
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
                  style={{ width: 10, height: 10, borderRadius: 3, background: CATEGORY_CONFIG[cat].color, flexShrink: 0 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <MyCategoriesSection />
    </main>
  );
}
