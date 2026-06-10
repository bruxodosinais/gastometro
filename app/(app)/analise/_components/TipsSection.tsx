'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import type {
  Budget,
  CustomCategory,
  Expense,
  ExpenseCategory,
  RecurringExpense,
} from '@/lib/types';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { coachRisingSpend, coachSavingsRate, type MissionContext } from '@/lib/insights/coach';
import { useMissionContext } from '@/lib/insights/useMissionContext';
import { buildMonthlyBuckets } from './chartUtils';

type Props = {
  entries: Expense[];
  months: string[];
  budgets: Budget[];
  recurringExpenses: RecurringExpense[];
};

type TipVariant = 'warning' | 'info' | 'positive';

type Tip = {
  id: string;
  variant: TipVariant;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  cta?: { label: string; href: string };
};

// ─── Cores por variant ────────────────────────────────────────────────────────

function variantColors(v: TipVariant) {
  switch (v) {
    case 'warning':
      return {
        bg: 'var(--red-bg)',
        border: 'rgba(255,71,87,0.25)',
        iconBg: 'var(--red)',
        iconColor: '#fff',
        accent: 'var(--red)',
      };
    case 'positive':
      return {
        bg: 'var(--green-bg)',
        border: 'rgba(0,195,122,0.25)',
        iconBg: 'var(--green)',
        iconColor: '#fff',
        accent: 'var(--green-text)',
      };
    default:
      return {
        bg: 'var(--accent-bg)',
        border: 'var(--accent-soft)',
        iconBg: 'var(--accent)',
        iconColor: '#fff',
        accent: 'var(--accent)',
      };
  }
}

// ─── Regras ───────────────────────────────────────────────────────────────────

function ruleUnbudgetedRecurring(
  entries: Expense[],
  months: string[],
  budgets: Budget[],
  customs: CustomCategory[],
): Tip | null {
  const budgeted = new Set(budgets.map((b) => b.category));
  // Conta, por categoria, em quantos meses distintos do período houve gasto.
  const monthsByCategory = new Map<ExpenseCategory, Set<string>>();
  for (const e of entries) {
    if (e.type !== 'expense') continue;
    const cat = e.category as ExpenseCategory;
    if (budgeted.has(cat)) continue;
    const key = e.date.slice(0, 7);
    if (!months.includes(key)) continue;
    if (!monthsByCategory.has(cat)) monthsByCategory.set(cat, new Set());
    monthsByCategory.get(cat)!.add(key);
  }
  // Pega a categoria com presença em mais meses (≥3).
  const candidates = [...monthsByCategory.entries()]
    .filter(([, set]) => set.size >= 3)
    .sort((a, b) => b[1].size - a[1].size);
  if (candidates.length === 0) return null;
  const [cat, set] = candidates[0];
  const cfg = getCategoryDisplay(cat, customs);
  return {
    id: 'unbudgeted-recurring',
    variant: 'info',
    icon: <Lightbulb size={15} />,
    title: `Você gasta em ${cat} todo mês mas não tem orçamento`,
    description: (
      <>
        {cfg?.icon} <strong>{cat}</strong> apareceu em {set.size} meses do
        período. Que tal criar um limite mensal pra acompanhar?
      </>
    ),
    cta: { label: 'Criar orçamento', href: '/categorias' },
  };
}

function ruleNegativeMonths(
  entries: Expense[],
  months: string[],
  recurringExpenses: RecurringExpense[],
  customs: CustomCategory[],
): Tip | null {
  const buckets = buildMonthlyBuckets(entries, months);
  const negatives = buckets.filter((b) => b.income > 0 && b.expense > b.income);
  if (negatives.length < 2) return null;
  // Pior mês = maior déficit absoluto (gasto − receita).
  const worst = [...negatives].sort(
    (a, b) => b.expense - b.income - (a.expense - a.income),
  )[0];

  // Top 2 categorias variáveis (sem recurringExpenseId) do pior mês.
  const recIds = new Set(recurringExpenses.map((r) => r.id));
  const totals = new Map<ExpenseCategory, number>();
  for (const e of entries) {
    if (e.type !== 'expense') continue;
    if (e.date.slice(0, 7) !== worst.monthKey) continue;
    if (e.recurringExpenseId && recIds.has(e.recurringExpenseId)) continue;
    const cat = e.category as ExpenseCategory;
    totals.set(cat, (totals.get(cat) ?? 0) + e.amount);
  }
  const top2 = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  return {
    id: 'negative-months',
    variant: 'warning',
    icon: <AlertTriangle size={15} />,
    title: `Em ${negatives.length} dos últimos ${months.length} meses, seus gastos superaram a receita`,
    description: (
      <>
        Pior mês foi <strong>{getMonthLabel(worst.monthKey)}</strong> ({formatCurrency(worst.expense - worst.income)} de déficit).
        {top2.length > 0 && (
          <>
            {' '}Maiores gastos variáveis:{' '}
            {top2.map(([cat, total], i) => (
              <span key={cat}>
                {i > 0 ? ', ' : ''}
                {getCategoryDisplay(cat, customs).icon} <strong>{cat}</strong> ({formatCurrency(total)})
              </span>
            ))}
            .
          </>
        )}
      </>
    ),
  };
}

function ruleLowSavings(
  entries: Expense[],
  months: string[],
  mission: MissionContext | null,
): Tip | null {
  const buckets = buildMonthlyBuckets(entries, months);
  const rates: number[] = [];
  for (const b of buckets) {
    if (b.income > 0) rates.push((b.income - b.expense) / b.income);
  }
  // Sem receita em nenhum mês → não dá pra avaliar.
  if (rates.length === 0) return null;
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
  if (avg >= 0.1) return null;
  const pct = Math.round(avg * 100);
  const coach = coachSavingsRate({ ratePct: pct, mission });
  return {
    id: 'low-savings',
    variant: 'warning',
    icon: <PiggyBank size={15} />,
    title: 'Dá pra guardar mais',
    description: (
      <>
        {coach.emoji} {coach.message}
      </>
    ),
    cta: coach.cta,
  };
}

function ruleRisingSpend(
  entries: Expense[],
  months: string[],
  customs: CustomCategory[],
  mission: MissionContext | null,
): Tip | null {
  if (months.length < 3) return null;
  const buckets = buildMonthlyBuckets(entries, months);
  const last3 = buckets.slice(-3);
  if (last3.length < 3) return null;
  const [m1, m2, m3] = last3;
  if (!(m1.expense > 0 && m2.expense > m1.expense && m3.expense > m2.expense)) {
    return null;
  }

  // Maior crescimento por categoria comparando m3 vs m1 (3 meses atrás).
  const sumCat = (monthKey: string): Map<ExpenseCategory, number> => {
    const totals = new Map<ExpenseCategory, number>();
    for (const e of entries) {
      if (e.type !== 'expense') continue;
      if (e.date.slice(0, 7) !== monthKey) continue;
      const cat = e.category as ExpenseCategory;
      totals.set(cat, (totals.get(cat) ?? 0) + e.amount);
    }
    return totals;
  };
  const t1 = sumCat(m1.monthKey);
  const t3 = sumCat(m3.monthKey);
  let topCat: ExpenseCategory | null = null;
  let topPct = -Infinity;
  for (const [cat, v3] of t3) {
    const v1 = t1.get(cat) ?? 0;
    if (v1 <= 0) continue;
    const pct = ((v3 - v1) / v1) * 100;
    if (pct > topPct) {
      topPct = pct;
      topCat = cat;
    }
  }

  const coach = coachRisingSpend({
    category: topCat,
    icon: topCat ? getCategoryDisplay(topCat, customs).icon : '',
    percentChange: topCat ? topPct : 0,
    fromMonthLabel: getMonthLabel(m1.monthKey),
    mission,
  });
  return {
    id: 'rising-spend',
    variant: 'warning',
    icon: <TrendingUp size={15} />,
    title: 'Seus gastos cresceram 3 meses seguidos',
    description: (
      <>
        {coach.emoji} {coach.message}
      </>
    ),
  };
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function TipCard({ tip }: { tip: Tip }) {
  const c = variantColors(tip.variant);
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 'var(--r)',
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: c.iconBg,
          color: c.iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {tip.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text)',
            margin: 0,
            marginBottom: 4,
            lineHeight: 1.3,
          }}
        >
          {tip.title}
        </p>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-2)',
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          {tip.description}
        </p>
        {tip.cta && (
          <Link
            href={tip.cta.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 8,
              fontSize: 12,
              fontWeight: 800,
              color: c.accent,
              textDecoration: 'none',
            }}
          >
            {tip.cta.label}
            <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TipsSection({
  entries,
  months,
  budgets,
  recurringExpenses,
}: Props) {
  const { categories: customs } = useCustomCategories();
  const { context: mission, loading: missionLoading } = useMissionContext();
  const tips: Tip[] = [];
  const t1 = ruleUnbudgetedRecurring(entries, months, budgets, customs);
  if (t1) tips.push(t1);
  const t2 = ruleNegativeMonths(entries, months, recurringExpenses, customs);
  if (t2) tips.push(t2);
  // Dicas ligadas à Missão só entram DEPOIS do contexto resolver — evita
  // mostrar o CTA "Criar Missão" (ou a copy genérica) pra quem já tem missão.
  if (!missionLoading) {
    const t3 = ruleLowSavings(entries, months, mission);
    if (t3) tips.push(t3);
    const t4 = ruleRisingSpend(entries, months, customs, mission);
    if (t4) tips.push(t4);
  }

  if (tips.length === 0) return null;

  return (
    <section className="space-y-3">
      <p
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: 0,
          marginBottom: 4,
          paddingLeft: 4,
        }}
      >
        Dicas pra você
      </p>
      <div className="space-y-2.5">
        {tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </section>
  );
}
