'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { formatCurrency } from '@/lib/calculations';
import type { Expense, ExpenseCategory } from '@/lib/types';

type Props = {
  entries: Expense[];
};

type TooltipPayload = {
  name: string;
  value: number;
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const cfg = CATEGORY_CONFIG[name as ExpenseCategory];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm shadow-xl">
      <span className="mr-1">{cfg?.icon}</span>
      <span className="text-white font-medium">{name}</span>
      <span className="text-slate-300 ml-2">{formatCurrency(value)}</span>
    </div>
  );
}

export default function SpendingDonut({ entries }: Props) {
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    if (e.type !== 'expense') continue;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  const data = Object.entries(byCategory)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Nenhum gasto neste período
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%" minHeight={0}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={CATEGORY_CONFIG[entry.name as ExpenseCategory]?.color ?? '#94a3b8'}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* total no centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-slate-400">Total</span>
          <span className="text-white font-bold text-base">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* legenda */}
      <div className="flex flex-col gap-1.5">
        {data.map((entry) => {
          const cfg = CATEGORY_CONFIG[entry.name as ExpenseCategory];
          const pct = ((entry.value / total) * 100).toFixed(0);
          return (
            <div key={entry.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cfg?.color ?? '#94a3b8' }}
                />
                <span className="text-slate-300 truncate">{cfg?.icon} {entry.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-slate-400 text-xs">{pct}%</span>
                <span className="text-white font-medium">{formatCurrency(entry.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
