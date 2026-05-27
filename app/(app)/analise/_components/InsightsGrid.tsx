'use client';

import { CalendarDays, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import type { Expense, ExpenseCategory } from '@/lib/types';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { buildMonthlyBuckets } from './chartUtils';

type Props = {
  entries: Expense[];
  prevEntries: Expense[];
  months: string[];
  prevMonths: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Média mensal de gasto por categoria, considerando o TAMANHO do período
 * (não só meses com gasto). Categorias sem nenhum gasto ficam fora.
 */
function avgByCategory(
  entries: Expense[],
  monthCount: number,
): Map<ExpenseCategory, number> {
  if (monthCount <= 0) return new Map();
  const totals = new Map<ExpenseCategory, number>();
  for (const e of entries) {
    if (e.type !== 'expense') continue;
    const cat = e.category as ExpenseCategory;
    totals.set(cat, (totals.get(cat) ?? 0) + e.amount);
  }
  const result = new Map<ExpenseCategory, number>();
  for (const [cat, total] of totals) {
    result.set(cat, total / monthCount);
  }
  return result;
}

type CategoryDelta = {
  category: ExpenseCategory;
  current: number;
  previous: number;
  pct: number; // (current - previous) / previous * 100
};

function categoryDeltas(
  curEntries: Expense[],
  prevEntries: Expense[],
  curMonths: number,
  prevMonths: number,
): CategoryDelta[] {
  const cur = avgByCategory(curEntries, curMonths);
  const prev = avgByCategory(prevEntries, prevMonths);
  const out: CategoryDelta[] = [];
  // Só comparamos categorias presentes nos DOIS períodos com prev > 0 — sem
  // isso, "cresceu ∞%" suja o ranking (categoria que acabou de surgir).
  for (const [cat, curAvg] of cur) {
    const prevAvg = prev.get(cat) ?? 0;
    if (prevAvg <= 0) continue;
    out.push({
      category: cat,
      current: curAvg,
      previous: prevAvg,
      pct: ((curAvg - prevAvg) / prevAvg) * 100,
    });
  }
  return out;
}

// ─── Componente de card ───────────────────────────────────────────────────────

type CardProps = {
  label: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  sublabelColor?: string;
};

function InsightCard({
  label,
  iconBg,
  iconColor,
  icon,
  value,
  sublabel,
  sublabelColor,
}: CardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 110,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text)',
            lineHeight: 1.25,
          }}
        >
          {value}
        </span>
        {sublabel && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: sublabelColor ?? 'var(--text-2)',
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── InsightsGrid ─────────────────────────────────────────────────────────────

export default function InsightsGrid({
  entries,
  prevEntries,
  months,
  prevMonths,
}: Props) {
  const { categories: customs } = useCustomCategories();
  // ─── 1 & 2: deltas de categorias ──────────────────────────────────────────
  const deltas = categoryDeltas(
    entries,
    prevEntries,
    months.length,
    prevMonths.length,
  );
  const grew = [...deltas]
    .filter((d) => d.pct > 0)
    .sort((a, b) => b.pct - a.pct)[0] ?? null;
  const fell = [...deltas]
    .filter((d) => d.pct < 0)
    .sort((a, b) => a.pct - b.pct)[0] ?? null;

  // ─── 3: mês com maior gasto ────────────────────────────────────────────────
  const buckets = buildMonthlyBuckets(entries, months);
  const topMonth = buckets
    .filter((b) => b.expense > 0)
    .sort((a, b) => b.expense - a.expense)[0] ?? null;

  // ─── 4: taxa de poupança média ─────────────────────────────────────────────
  const ratesPerMonth: number[] = [];
  for (const b of buckets) {
    if (b.income > 0) ratesPerMonth.push((b.income - b.expense) / b.income);
  }
  const savingsRate =
    ratesPerMonth.length > 0
      ? ratesPerMonth.reduce((s, r) => s + r, 0) / ratesPerMonth.length
      : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* 1 — mais cresceu */}
      <InsightCard
        label="Mais cresceu"
        iconBg="var(--red-bg)"
        iconColor="var(--red)"
        icon={<TrendingUp size={15} />}
        value={
          grew ? (
            <span>
              {getCategoryDisplay(grew.category, customs).icon} {grew.category}
            </span>
          ) : (
            '—'
          )
        }
        sublabel={
          grew
            ? `↑ ${Math.round(grew.pct)}% vs período anterior`
            : 'Sem comparativo'
        }
        sublabelColor={grew ? 'var(--red)' : undefined}
      />

      {/* 2 — mais caiu */}
      <InsightCard
        label="Mais caiu"
        iconBg="var(--green-bg)"
        iconColor="var(--green)"
        icon={<TrendingDown size={15} />}
        value={
          fell ? (
            <span>
              {getCategoryDisplay(fell.category, customs).icon} {fell.category}
            </span>
          ) : (
            '—'
          )
        }
        sublabel={
          fell
            ? `↓ ${Math.round(Math.abs(fell.pct))}% vs período anterior`
            : 'Sem comparativo'
        }
        sublabelColor={fell ? 'var(--green)' : undefined}
      />

      {/* 3 — mês de maior gasto */}
      <InsightCard
        label="Mês de maior gasto"
        iconBg="var(--accent-bg)"
        iconColor="var(--accent)"
        icon={<CalendarDays size={15} />}
        value={topMonth ? getMonthLabel(topMonth.monthKey) : '—'}
        sublabel={topMonth ? formatCurrency(topMonth.expense) : 'Sem dados'}
      />

      {/* 4 — taxa de poupança média */}
      <InsightCard
        label="Poupança média"
        iconBg="var(--accent-bg)"
        iconColor="var(--accent)"
        icon={<PiggyBank size={15} />}
        value={
          savingsRate == null
            ? '—'
            : `${(savingsRate * 100).toFixed(savingsRate >= 0.1 || savingsRate <= -0.1 ? 0 : 1)}%`
        }
        sublabel={
          savingsRate == null
            ? 'Sem receitas no período'
            : savingsRate >= 0
            ? 'Em média você economiza por mês'
            : 'Você gasta mais do que recebe em média'
        }
        sublabelColor={
          savingsRate == null
            ? undefined
            : savingsRate >= 0
            ? 'var(--green)'
            : 'var(--red)'
        }
      />
    </div>
  );
}
