'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { getExpenses } from '@/lib/storage';
import {
  formatCurrency,
  getCategoryAlerts,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import { CategorySummary, Expense } from '@/lib/types';

export default function CategoriasPage() {
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getExpenses().then((data) => {
      setExpenses(data);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const summaries: CategorySummary[] = getCategoryAlerts(expenses, period);
  const maxTotal = Math.max(...summaries.map((s) => Math.max(s.total, s.average)), 1);

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Categorias</h1>
      <p className="text-slate-400 text-sm capitalize mb-5">{getMonthLabel(period)}</p>

      <PeriodSelector />

      {/* Legenda */}
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

      <div className="space-y-3">
        {summaries.map((summary) => {
          const cfg = CATEGORY_CONFIG[summary.category];
          const currentWidth = (summary.total / maxTotal) * 100;
          const avgWidth = (summary.average / maxTotal) * 100;
          const hasData = summary.total > 0 || summary.average > 0;

          return (
            <div
              key={summary.category}
              className={`bg-slate-900 border rounded-2xl p-4 ${
                summary.isAlert ? 'border-red-500/30' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${cfg.bgClass}`}>
                    {cfg.icon}
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">{summary.category}</p>
                    {summary.isAlert && (
                      <p className="text-red-400 text-xs font-medium">⚠ Acima do normal</p>
                    )}
                  </div>
                </div>

                {summary.average > 0 && (
                  <div
                    className={`flex items-center gap-1 text-sm font-semibold ${
                      summary.percentChange > 20
                        ? 'text-red-400'
                        : summary.percentChange < -20
                        ? 'text-green-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {summary.percentChange > 5 ? (
                      <TrendingUp size={14} />
                    ) : summary.percentChange < -5 ? (
                      <TrendingDown size={14} />
                    ) : (
                      <Minus size={14} />
                    )}
                    {summary.percentChange > 0 ? '+' : ''}
                    {Math.round(summary.percentChange)}%
                  </div>
                )}
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
                <div className="space-y-1.5">
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

              {!hasData && (
                <p className="text-slate-600 text-xs">Sem lançamentos nesta categoria</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
