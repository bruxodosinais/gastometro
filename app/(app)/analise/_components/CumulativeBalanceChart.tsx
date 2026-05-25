'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
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

type TooltipPayload = { name: string; value: number };

function AcuTooltip({
  active,
  payload,
  label,
  surface,
  border,
  text3,
  accent,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  surface: string;
  border: string;
  text3: string;
  accent: string;
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
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ color: text3, fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: accent, fontWeight: 700, margin: 0 }}>
        Saldo acumulado: {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export default function CumulativeBalanceChart({ entries, months }: Props) {
  const colors = useThemeColors();
  const buckets = buildMonthlyBuckets(entries, months);

  let acc = 0;
  const data = buckets.map((b) => {
    acc += b.balance;
    return { label: b.label, acumulado: parseFloat(acc.toFixed(2)) };
  });

  const hasAny = buckets.some((b) => b.income > 0 || b.expense > 0);
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
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="acuGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            width={48}
          />
          <Tooltip
            cursor={{ stroke: colors.border, strokeWidth: 1 }}
            content={
              <AcuTooltip
                surface={colors.surface}
                border={colors.border}
                text3={colors.text3}
                accent={colors.accent}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="acumulado"
            stroke={colors.accent}
            strokeWidth={2.5}
            fill="url(#acuGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
