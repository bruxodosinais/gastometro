'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { calculateTotalByType, getMonthKey } from '@/lib/calculations';
import { formatCurrency } from '@/lib/calculations';
import type { Expense } from '@/lib/types';

type Props = {
  allExpenses: Expense[];
  currentPeriod: string; // YYYY-MM
};

type TooltipPayload = {
  name: string;
  value: number;
  color: string;
};

function CustomTooltip({
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
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

function buildLast6Months(currentPeriod: string): string[] {
  const [y, m] = currentPeriod.split('-').map(Number);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i);
    months.push(getMonthKey(d));
  }
  return months;
}

function shortLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1);
  const label = d.toLocaleDateString('pt-BR', { month: 'short' });
  return label.replace('.', '').replace(/^\w/, (c) => c.toUpperCase());
}

export default function MonthlyBars({ allExpenses, currentPeriod }: Props) {
  const months = buildLast6Months(currentPeriod);

  const data = months.map((month) => {
    const entries = allExpenses.filter((e) => e.date.slice(0, 7) === month);
    return {
      name: shortLabel(month),
      Ganhos: parseFloat(calculateTotalByType(entries, 'income').toFixed(2)),
      Gastos: parseFloat(calculateTotalByType(entries, 'expense').toFixed(2)),
    };
  });

  const hasAny = data.some((d) => d.Ganhos > 0 || d.Gastos > 0);
  if (!hasAny) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Sem dados nos últimos 6 meses
      </div>
    );
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%" minHeight={0}>
        <BarChart data={data} barCategoryGap="28%" barGap={3}>
          <CartesianGrid vertical={false} stroke="#1e293b" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
          <Bar dataKey="Ganhos" fill="#00b87a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gastos" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
