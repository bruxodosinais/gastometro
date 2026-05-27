'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import type { CustomCategory, Expense, ExpenseCategory } from '@/lib/types';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { formatAxisCurrency, shortMonthLabel } from './chartUtils';
import { useThemeColors } from './useThemeColors';

type Props = {
  entries: Expense[];
  months: string[];
};

type TooltipPayload = { name: string; value: number; color: string };

function TopTooltip({
  active,
  payload,
  label,
  surface,
  border,
  text3,
  customs,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  surface: string;
  border: string;
  text3: string;
  customs: CustomCategory[];
}) {
  if (!active || !payload?.length) return null;
  // Recharts manda todas as séries — filtra zeros pra não poluir.
  const nonZero = payload.filter((p) => p.value > 0);
  if (nonZero.length === 0) return null;
  return (
    <div
      style={{
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ color: text3, fontSize: 11, marginBottom: 4 }}>{label}</p>
      {nonZero.map((p) => {
        const cfg = getCategoryDisplay(p.name, customs);
        return (
          <p key={p.name} style={{ color: p.color, fontWeight: 700, margin: 0 }}>
            {cfg.icon} {p.name}: {formatCurrency(p.value)}
          </p>
        );
      })}
    </div>
  );
}

export default function TopCategoriesLineChart({ entries, months }: Props) {
  const colors = useThemeColors();
  const { categories: customs } = useCustomCategories();

  // 1. Total por categoria no período inteiro pra definir o top 5.
  const totalByCat = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'expense') continue;
    totalByCat.set(e.category, (totalByCat.get(e.category) ?? 0) + e.amount);
  }
  const top5 = [...totalByCat.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat as ExpenseCategory);

  if (top5.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 200, color: 'var(--text-3)', fontSize: 13 }}
      >
        Sem gastos no período selecionado
      </div>
    );
  }

  // 2. Para cada mês, valor de cada categoria do top 5.
  const spansMultipleYears =
    new Set(months.map((m) => m.slice(0, 4))).size > 1;

  const data = months.map((monthKey) => {
    const row: Record<string, string | number> = {
      label: shortMonthLabel(monthKey, spansMultipleYears),
    };
    for (const cat of top5) row[cat] = 0;
    for (const e of entries) {
      if (e.type !== 'expense') continue;
      if (e.date.slice(0, 7) !== monthKey) continue;
      if (!(e.category in row)) continue;
      row[e.category] = (row[e.category] as number) + e.amount;
    }
    return row;
  });

  return (
    <div>
      <div className="h-[200px] md:h-[280px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={0}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.border} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.text3, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatAxisCurrency}
              tick={{ fill: colors.text3, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: colors.border, strokeWidth: 1 }}
              content={
                <TopTooltip
                  surface={colors.surface}
                  border={colors.border}
                  text3={colors.text3}
                  customs={customs}
                />
              }
            />
            {top5.map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={getCategoryDisplay(cat, customs).color}
                strokeWidth={2}
                dot={{ r: 2.5 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-3 mt-3 justify-center flex-wrap">
        {top5.map((cat) => {
          const cfg = getCategoryDisplay(cat, customs);
          return (
            <div key={cat} className="flex items-center gap-1.5">
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: cfg.color,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                {cfg.icon} {cat}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
