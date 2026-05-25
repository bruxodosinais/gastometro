'use client';

import {
  Bar,
  BarChart,
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
  prevEntries: Expense[];
  months: string[];
  prevMonths: string[];
};

type Row = {
  label: string;       // label do mês ATUAL
  prevLabel: string;   // label do mês equivalente anterior
  atual: number;       // gasto do mês atual
  anterior: number;    // gasto do mês equivalente anterior
};

type TooltipPayload = { name: string; value: number; color: string; payload: Row };

function CompareTooltip({
  active,
  payload,
  surface,
  border,
  text3,
  green,
  red,
  text2,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  surface: string;
  border: string;
  text3: string;
  green: string;
  red: string;
  text2: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  // Variação % do atual em relação ao anterior. Subir = vermelho (gastou mais),
  // cair = verde (gastou menos).
  let variation: number | null = null;
  if (row.anterior > 0) variation = ((row.atual - row.anterior) / row.anterior) * 100;
  const varColor = variation == null ? text3 : variation >= 0 ? red : green;
  const varSign = variation == null ? '' : variation >= 0 ? '+' : '';
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
      <p style={{ color: text3, fontSize: 11, marginBottom: 4 }}>
        {row.label} vs {row.prevLabel}
      </p>
      <p style={{ color: text2, fontWeight: 600, margin: 0 }}>
        Atual: <span style={{ color: 'inherit', fontWeight: 700 }}>{formatCurrency(row.atual)}</span>
      </p>
      <p style={{ color: text3, fontWeight: 600, margin: 0 }}>
        Anterior: <span style={{ color: 'inherit', fontWeight: 700 }}>{formatCurrency(row.anterior)}</span>
      </p>
      {variation != null && (
        <p style={{ color: varColor, fontWeight: 800, margin: 0, marginTop: 4 }}>
          {varSign}{variation.toFixed(1)}%
        </p>
      )}
    </div>
  );
}

export default function PeriodComparisonChart({
  entries,
  prevEntries,
  months,
  prevMonths,
}: Props) {
  const colors = useThemeColors();
  const current = buildMonthlyBuckets(entries, months);
  const previous = buildMonthlyBuckets(prevEntries, prevMonths);

  // Alinha por índice posicional: 1º mês do atual ↔ 1º mês do anterior.
  // Se prev tem comprimento diferente (raro nos presets fechados, possível
  // em ranges customizados futuros), preenche com 0.
  const data: Row[] = current.map((cur, i) => {
    const prev = previous[i];
    return {
      label: cur.label,
      prevLabel: prev ? prev.label : '—',
      atual: parseFloat(cur.expense.toFixed(2)),
      anterior: prev ? parseFloat(prev.expense.toFixed(2)) : 0,
    };
  });

  const hasAny = data.some((d) => d.atual > 0 || d.anterior > 0);
  if (!hasAny) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 200, color: 'var(--text-3)', fontSize: 13 }}
      >
        Sem dados para comparar
      </div>
    );
  }

  return (
    <div>
      {/* Header textual */}
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: colors.accent,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
            Período atual
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: colors.text3,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
            Período anterior
          </span>
        </div>
      </div>

      <div className="h-[200px] md:h-[280px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={0}>
          <BarChart data={data} barCategoryGap="28%" barGap={3}>
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
              cursor={{ fill: colors.border2, opacity: 0.4 }}
              content={
                <CompareTooltip
                  surface={colors.surface}
                  border={colors.border}
                  text3={colors.text3}
                  text2={colors.text2}
                  green={colors.green}
                  red={colors.red}
                />
              }
            />
            <Bar
              dataKey="atual"
              name="Atual"
              fill={colors.accent}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="anterior"
              name="Anterior"
              fill={colors.text3}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
