'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getBudgets, getExpenses, getRecurringExpenses } from '@/lib/storage';
import { getErrorMessage } from '@/lib/errors';
import { retryAsync } from '@/lib/retry';
import { useSubscription } from '@/hooks/useSubscription';
import type { Budget, Expense, RecurringExpense } from '@/lib/types';
import IncomeVsExpenseChart from './_components/IncomeVsExpenseChart';
import CumulativeBalanceChart from './_components/CumulativeBalanceChart';
import CategoryDonutSection from './_components/CategoryDonutSection';
import TopCategoriesLineChart from './_components/TopCategoriesLineChart';
import PeriodComparisonChart from './_components/PeriodComparisonChart';
import ProGateCard from './_components/ProGateCard';
import InsightsGrid from './_components/InsightsGrid';
import TipsSection from './_components/TipsSection';

// ─── Tipos de período ─────────────────────────────────────────────────────────

type RangePreset = '3m' | '6m' | '12m' | 'thisYear' | 'lastYear';

const RANGE_LABELS: Record<RangePreset, string> = {
  '3m': '3 meses',
  '6m': '6 meses',
  '12m': '12 meses',
  thisYear: 'Este ano',
  lastYear: 'Ano anterior',
};

const RANGE_ORDER: RangePreset[] = ['3m', '6m', '12m', 'thisYear', 'lastYear'];

// ─── Derivações de período ────────────────────────────────────────────────────

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function isoFromYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthsInRange(rangeFrom: string, rangeTo: string): string[] {
  const fromKey = rangeFrom.slice(0, 7);
  const toKey = rangeTo.slice(0, 7);
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

type DerivedRange = {
  rangeFrom: string;
  rangeTo: string;
  prevFrom: string;
  prevTo: string;
  label: string;
  months: string[];
  prevMonths: string[];
};

/**
 * 3m/6m/12m incluem o mês atual (mesma convenção do MonthlyBars). thisYear
 * cobre de jan até o mês atual; lastYear cobre o ano inteiro anterior. O
 * "período anterior" é o intervalo equivalente imediatamente antes.
 */
function deriveRange(preset: RangePreset, now: Date): DerivedRange {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  function nMonths(count: number): DerivedRange {
    const startDate = new Date(y, m - count, 1);
    const sy = startDate.getFullYear();
    const sm = startDate.getMonth() + 1;
    const rangeFrom = isoFromYMD(sy, sm, 1);
    const rangeTo = isoFromYMD(y, m, lastDayOfMonth(y, m));

    const prevEndDate = new Date(sy, sm - 1, 0);
    const prevEy = prevEndDate.getFullYear();
    const prevEm = prevEndDate.getMonth() + 1;
    const prevStartDate = new Date(prevEy, prevEm - count, 1);
    const psy = prevStartDate.getFullYear();
    const psm = prevStartDate.getMonth() + 1;
    const prevFrom = isoFromYMD(psy, psm, 1);
    const prevTo = isoFromYMD(prevEy, prevEm, lastDayOfMonth(prevEy, prevEm));

    return {
      rangeFrom,
      rangeTo,
      prevFrom,
      prevTo,
      label: RANGE_LABELS[preset],
      months: monthsInRange(rangeFrom, rangeTo),
      prevMonths: monthsInRange(prevFrom, prevTo),
    };
  }

  if (preset === '3m') return nMonths(3);
  if (preset === '6m') return nMonths(6);
  if (preset === '12m') return nMonths(12);

  if (preset === 'thisYear') {
    const rangeFrom = isoFromYMD(y, 1, 1);
    const rangeTo = isoFromYMD(y, m, lastDayOfMonth(y, m));
    const prevFrom = isoFromYMD(y - 1, 1, 1);
    const prevTo = isoFromYMD(y - 1, m, lastDayOfMonth(y - 1, m));
    return {
      rangeFrom,
      rangeTo,
      prevFrom,
      prevTo,
      label: `Este ano (${y})`,
      months: monthsInRange(rangeFrom, rangeTo),
      prevMonths: monthsInRange(prevFrom, prevTo),
    };
  }

  const ly = y - 1;
  const rangeFrom = isoFromYMD(ly, 1, 1);
  const rangeTo = isoFromYMD(ly, 12, 31);
  const prevFrom = isoFromYMD(ly - 1, 1, 1);
  const prevTo = isoFromYMD(ly - 1, 12, 31);
  return {
    rangeFrom,
    rangeTo,
    prevFrom,
    prevTo,
    label: `Ano anterior (${ly})`,
    months: monthsInRange(rangeFrom, rangeTo),
    prevMonths: monthsInRange(prevFrom, prevTo),
  };
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        height,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent, var(--logo-bg), transparent)',
          animation: 'shimmer 1.4s infinite',
        }}
      />
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '14px 16px',
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
        {title}
      </p>
      {subtitle && (
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-3)',
            margin: 0,
            marginTop: 2,
            marginBottom: 10,
          }}
        >
          {subtitle}
        </p>
      )}
      {!subtitle && <div style={{ height: 10 }} />}
      {children}
    </section>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AnalisePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangePreset>('6m');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const { isPro, loading: subLoading } = useSubscription();

  async function loadData() {
    setLoadError(null);
    try {
      const [exp, bud, recs] = await retryAsync(() =>
        Promise.all([getExpenses(), getBudgets(), getRecurringExpenses()])
      );
      setExpenses(exp);
      setBudgets(bud);
      setRecurringExpenses(recs);
      setReady(true);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refresh = () => {
      Promise.all([getExpenses(), getBudgets(), getRecurringExpenses()]).then(
        ([exp, bud, recs]) => {
          setExpenses(exp);
          setBudgets(bud);
          setRecurringExpenses(recs);
        },
      );
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('gastometro_expense_added', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('gastometro_expense_added', refresh);
    };
  }, []);

  const derived = useMemo(() => deriveRange(selectedRange, new Date()), [selectedRange]);
  const { rangeFrom, rangeTo, prevFrom, prevTo, label, months, prevMonths } = derived;

  const filteredEntries = useMemo(
    () => expenses.filter((e) => e.date >= rangeFrom && e.date <= rangeTo),
    [expenses, rangeFrom, rangeTo]
  );
  const prevEntries = useMemo(
    () => expenses.filter((e) => e.date >= prevFrom && e.date <= prevTo),
    [expenses, prevFrom, prevTo]
  );

  // ─── Loading / erro ─────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <main className="max-w-lg mx-auto px-4 pt-16 pb-10 flex flex-col items-center gap-4 text-center">
        <p className="text-4xl">😕</p>
        <p style={{ color: 'var(--text-2)', fontWeight: 500 }}>{loadError}</p>
        <button
          onClick={loadData}
          className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <RefreshCw size={15} />
          Tentar novamente
        </button>
      </main>
    );
  }

  const isFree = !subLoading && !isPro;
  const hasData = filteredEntries.length > 0;

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      {/* Header */}
      <h1
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 800,
          fontSize: 24,
          color: 'var(--text)',
          marginBottom: 4,
        }}
      >
        Análise
      </h1>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-3)',
          marginBottom: 16,
        }}
      >
        {label}
      </p>

      {/* Seletor de período (presets em pill) */}
      <div
        className="flex gap-2 mb-3"
        style={{
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        }}
      >
        {RANGE_ORDER.map((key) => {
          const active = selectedRange === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedRange(key)}
              className="transition-opacity hover:opacity-80"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--text-2)',
                border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
              }}
            >
              {RANGE_LABELS[key]}
            </button>
          );
        })}
      </div>

      {/* Toggle comparar com período anterior */}
      <label
        className="flex items-center gap-2 mb-5 select-none"
        style={{ cursor: 'pointer', width: 'fit-content' }}
      >
        <span
          onClick={() => setCompareEnabled((v) => !v)}
          style={{
            width: 34,
            height: 20,
            borderRadius: 999,
            background: compareEnabled ? 'var(--accent)' : 'var(--border)',
            position: 'relative',
            transition: 'background 150ms',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: compareEnabled ? 16 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 150ms',
            }}
          />
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
          Comparar com período anterior
        </span>
      </label>

      {/* Conteúdo */}
      {!ready ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SkeletonCard height={88} />
            <SkeletonCard height={88} />
            <SkeletonCard height={88} />
            <SkeletonCard height={88} />
          </div>
          <SkeletonCard height={240} />
          <SkeletonCard height={240} />
        </div>
      ) : !hasData ? (
        <div className="py-12 text-center">
          <p className="text-5xl mb-3">📈</p>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
            Sem dados neste período
          </p>
          <p
            style={{
              color: 'var(--text-2)',
              fontSize: 14,
              maxWidth: 320,
              margin: '0 auto',
            }}
          >
            Lance receitas e gastos no intervalo selecionado para ver gráficos e insights.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Insights 2×2 — vêm acima dos gráficos */}
          <InsightsGrid
            entries={filteredEntries}
            prevEntries={prevEntries}
            months={months}
            prevMonths={prevMonths}
          />

          {/* A — Receitas vs Gastos + Saldo líquido (FREE) */}
          <SectionCard
            title="Receitas vs Gastos"
            subtitle="Por mês — linha mostra o saldo líquido"
          >
            <IncomeVsExpenseChart entries={filteredEntries} months={months} />
          </SectionCard>

          {/* B — Saldo acumulado (FREE) */}
          <SectionCard
            title="Saldo acumulado"
            subtitle="Soma cumulativa do saldo mês a mês"
          >
            <CumulativeBalanceChart entries={filteredEntries} months={months} />
          </SectionCard>

          {/* C — Distribuição por categoria (PRO) */}
          <SectionCard
            title="Distribuição por categoria"
            subtitle="Total de gastos no período por categoria"
          >
            {isFree ? (
              <ProGateCard
                title="Veja onde seu dinheiro está indo"
                description="Tenha a quebra dos gastos por categoria no período inteiro, com ranking e percentuais."
                feature="analise-donut"
              />
            ) : (
              <CategoryDonutSection entries={filteredEntries} />
            )}
          </SectionCard>

          {/* D — Top 5 categorias mês a mês (PRO) */}
          <SectionCard
            title="Top 5 categorias — evolução"
            subtitle="Como suas 5 maiores categorias se comportaram mês a mês"
          >
            {isFree ? (
              <ProGateCard
                title="Acompanhe a evolução das suas categorias"
                description="Veja em quais categorias seus gastos estão subindo ou caindo, mês a mês."
                feature="analise-top-categorias"
              />
            ) : (
              <TopCategoriesLineChart entries={filteredEntries} months={months} />
            )}
          </SectionCard>

          {/* E — Comparativo períodos (PRO, condicional) */}
          {compareEnabled && (
            <SectionCard
              title="Comparativo de períodos"
              subtitle="Gasto mês a mês: período atual vs equivalente anterior"
            >
              {isFree ? (
                <ProGateCard
                  title="Compare períodos lado a lado"
                  description="Veja exatamente quanto a mais (ou a menos) você gastou em cada mês frente ao período anterior."
                  feature="analise-comparativo"
                />
              ) : (
                <PeriodComparisonChart
                  entries={filteredEntries}
                  prevEntries={prevEntries}
                  months={months}
                  prevMonths={prevMonths}
                />
              )}
            </SectionCard>
          )}

          {/* Dicas personalizadas — só aparece se alguma regra bater. */}
          <TipsSection
            entries={filteredEntries}
            months={months}
            budgets={budgets}
            recurringExpenses={recurringExpenses}
          />
        </div>
      )}

      {/* shimmer keyframe local (skeleton) */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </main>
  );
}
