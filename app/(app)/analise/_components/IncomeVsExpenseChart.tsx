'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/calculations';
import type { Expense } from '@/lib/types';
import { buildMonthlyBuckets, formatAxisCurrency } from './chartUtils';
import { useThemeColors } from './useThemeColors';

type Props = {
  entries: Expense[];
  months: string[];
};

type TooltipPayload = {
  name: string;
  value: number;
  color: string;
};

function ChartTooltip({
  active,
  payload,
  label,
  surface,
  border,
  text2,
  text3,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  surface: string;
  border: string;
  text2: string;
  text3: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        color: text2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ color: text3, fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 700, margin: 0 }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function IncomeVsExpenseChart({ entries, months }: Props) {
  const colors = useThemeColors();
  const data = buildMonthlyBuckets(entries, months);
  const hasAny = data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasAny) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 200, color: 'var(--text-3)', fontSize: 13 }}
      >
        Sem dados no período selecionado
      </div>
    );
  }

  return (
    <div className="h-[200px] md:h-[280px]">
      <ResponsiveContainer width="100%" height="100%" minHeight={0}>
        <ComposedChart data={data} barCategoryGap="24%" barGap={3}>
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
            width={40}
          />
          <Tooltip
            cursor={{ fill: colors.border2, opacity: 0.4 }}
            content={
              <ChartTooltip
                surface={colors.surface}
                border={colors.border}
                text2={colors.text2}
                text3={colors.text3}
              />
            }
          />
          <Bar
            dataKey="income"
            name="Receitas"
            fill={colors.green}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="expense"
            name="Gastos"
            fill={colors.red}
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="balance"
            name="Saldo"
            stroke={colors.accent}
            strokeWidth={2.5}
            dot={{ r: 3, fill: colors.accent, stroke: colors.surface, strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-2 justify-center flex-wrap">
        <Legend dot={colors.green} label="Receitas" />
        <Legend dot={colors.red} label="Gastos" />
        <Legend dot={colors.accent} label="Saldo líquido" />
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 10, height: 10, borderRadius: 3, background: dot }} />
      <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{label}</span>
    </div>
  );
}
