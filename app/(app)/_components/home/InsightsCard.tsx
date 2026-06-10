'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { anim, hidden } from './_anim';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { EXPENSE_CATEGORIES, type Expense } from '@/lib/types';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { coachProjection, coachScore, coachTopCategory } from '@/lib/insights/coach';
import { useMissionContext } from '@/lib/insights/useMissionContext';

type Props = {
  expenses: Expense[];
  period: string;
  income: number;
  debitSpent: number;
  budgetPct: number;
  mounted: boolean;
};

const ACCENT = '#5B5BD6';
const GREEN = '#00C37A';
const RED = '#FF4757';

export default function InsightsCard({
  expenses,
  period,
  income,
  debitSpent,
  budgetPct,
  mounted,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { categories: customs } = useCustomCategories();
  const { context: mission, loading: missionLoading } = useMissionContext();

  // ── Dates ────────────────────────────────────────────────────────────────
  const now = new Date();
  const [periodYear, periodMonth] = period.split('-').map(Number);
  const totalDaysInMonth = new Date(periodYear, periodMonth, 0).getDate();
  const isCurrentMonth = period === getMonthKey(now);
  const daysElapsed = isCurrentMonth ? now.getDate() : totalDaysInMonth;

  // ── Period expenses (exclui 'Saldo inicial' — categoria de sistema) ──────
  const periodExpenses = expenses.filter(
    (e) =>
      e.date.slice(0, 7) === period &&
      e.type === 'expense' &&
      e.category !== 'Saldo inicial',
  );

  // ── Totais por categoria ─────────────────────────────────────────────────
  const totalsByCat = EXPENSE_CATEGORIES.map((cat) => ({
    cat,
    total: periodExpenses
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.amount, 0),
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const topCat = totalsByCat[0];
  const top3 = totalsByCat.slice(0, 3);
  const totalGasto = totalsByCat.reduce((s, c) => s + c.total, 0);

  // ── Projeção: gasto linear projetado p/ fim do mês ───────────────────────
  // Usa debitSpent (gasto em caixa do mês) — mesma base do orçamento, então
  // a "sobra/falta" projetada bate com a régua mostrada no card de orçamento.
  const gastoProjetado =
    daysElapsed > 0 ? (debitSpent / daysElapsed) * totalDaysInMonth : 0;
  const sobra = income - gastoProjetado;
  const showProjection = isCurrentMonth && income > 0 && debitSpent > 0;

  // ── Comparativo com mês anterior (por categoria do top 3) ────────────────
  const prevDate = new Date(periodYear, periodMonth - 2, 1);
  const prevKey = getMonthKey(prevDate);
  const prevExpenses = expenses.filter(
    (e) =>
      e.date.slice(0, 7) === prevKey &&
      e.type === 'expense' &&
      e.category !== 'Saldo inicial',
  );
  const comparisons = top3.map(({ cat, total }) => {
    const prevTotal = prevExpenses
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.amount, 0);
    return { cat, total, prevTotal, diff: total - prevTotal };
  });
  const hasPrevData = prevExpenses.length > 0;

  // ── Dia da semana com mais gastos ────────────────────────────────────────
  // Parse manual da data (YYYY-MM-DD) pra evitar off-by-one por timezone.
  const dowNames = [
    'Domingos',
    'Segundas',
    'Terças',
    'Quartas',
    'Quintas',
    'Sextas',
    'Sábados',
  ];
  const totalsByDow = [0, 0, 0, 0, 0, 0, 0];
  for (const e of periodExpenses) {
    const [y, m, d] = e.date.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    totalsByDow[dow] += e.amount;
  }
  const maxDowValue = Math.max(...totalsByDow);
  const maxDowIdx = totalsByDow.indexOf(maxDowValue);
  const hasDowData = maxDowValue > 0;

  // ── Coach (Item 7): top-categoria, projeção e score em tom de coach ───────
  const topCatCoach = topCat
    ? coachTopCategory({
        category: topCat.cat,
        icon: getCategoryDisplay(topCat.cat, customs).icon,
        total: topCat.total,
        mission,
      })
    : null;
  const projectionCoach = showProjection ? coachProjection({ projectedLeftover: sobra, mission }) : null;
  const scoreCoach = coachScore({ budgetPct, mission });

  const hasAnyData = periodExpenses.length > 0;

  return (
    <div
      style={{
        margin: '12px 16px 0',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        ...(mounted ? anim(400) : hidden),
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          background: 'var(--accent-bg)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 15,
        }}
      >
        💡
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text)',
            margin: 0,
            marginBottom: hasAnyData ? 6 : 4,
          }}
        >
          Seu mês em números
        </p>

        {!hasAnyData ? (
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-2)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Lance seus primeiros gastos para ver insights personalizados.
          </p>
        ) : (
          <>
            {/* ── Estado colapsado: sempre visível ─────────────────────── */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {topCat && (
                <li style={{ lineHeight: 1.4 }}>
                  {missionLoading ? (
                    <span className="skeleton" style={{ display: 'block', height: 14, width: '90%', borderRadius: 4 }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
                      {topCatCoach?.emoji} {topCatCoach?.message}
                    </span>
                  )}
                </li>
              )}
              {showProjection && (
                <li style={{ marginTop: topCat ? 4 : 0, lineHeight: 1.4 }}>
                  {missionLoading ? (
                    <span className="skeleton" style={{ display: 'block', height: 14, width: '95%', borderRadius: 4 }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 500, color: sobra >= 0 ? GREEN : RED }}>
                      {projectionCoach?.emoji} {projectionCoach?.message}
                    </span>
                  )}
                </li>
              )}
            </ul>

            {/* ── Botão expand ─────────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 10,
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: ACCENT,
                fontSize: 13,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
              }}
              aria-expanded={expanded}
            >
              {expanded ? 'Ocultar análise' : 'Ver análise completa'}
              <ChevronDown
                size={14}
                style={{
                  transition: 'transform 250ms ease',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {/* ── Estado expandido ─────────────────────────────────────── */}
            <div
              style={{
                display: 'grid',
                gridTemplateRows: expanded ? '1fr' : '0fr',
                transition: 'grid-template-rows 300ms ease',
                marginTop: expanded ? 12 : 0,
              }}
            >
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
                {/* 1. Top 3 categorias com barra de progresso */}
                {top3.length > 0 && (
                  <section style={{ marginBottom: 14 }}>
                    <h4
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-2)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        margin: '0 0 8px',
                      }}
                    >
                      Top categorias
                    </h4>
                    {top3.map(({ cat, total }) => {
                      const pct = totalGasto > 0 ? (total / totalGasto) * 100 : 0;
                      const icon = getCategoryDisplay(cat, customs).icon;
                      return (
                        <div key={cat} style={{ marginBottom: 8 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 12,
                              color: 'var(--text)',
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              {icon} {cat}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: 'var(--text-2)',
                                fontSize: 11,
                              }}
                            >
                              {formatCurrency(total)} · {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: 'var(--border-2)',
                              borderRadius: 3,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: ACCENT,
                                borderRadius: 3,
                                transition: 'width 500ms ease',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </section>
                )}

                {/* 2. Comparativo com mês anterior */}
                {hasPrevData && comparisons.length > 0 && (
                  <section style={{ marginBottom: 14 }}>
                    <h4
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-2)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        margin: '0 0 8px',
                      }}
                    >
                      vs mês anterior
                    </h4>
                    {comparisons.map(({ cat, diff }) => {
                      const icon = getCategoryDisplay(cat, customs).icon;
                      const isUp = diff > 0;
                      const isFlat = Math.abs(diff) < 0.01;
                      return (
                        <div
                          key={cat}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                            {icon} {cat}
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isFlat
                                ? 'var(--text-2)'
                                : isUp
                                ? RED
                                : GREEN,
                              fontSize: 12,
                            }}
                          >
                            {isFlat
                              ? '—'
                              : `${isUp ? '+' : '-'}${formatCurrency(Math.abs(diff))}`}
                          </span>
                        </div>
                      );
                    })}
                  </section>
                )}

                {/* 3. Dia da semana com mais gastos */}
                {hasDowData && (
                  <section style={{ marginBottom: 14 }}>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--text-2)',
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      Você gasta mais às{' '}
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>
                        {dowNames[maxDowIdx]}
                      </span>{' '}
                      · {formatCurrency(maxDowValue)} no total
                    </p>
                  </section>
                )}

                {/* 4. Score do mês */}
                <section>
                  <div
                    style={{
                      background: 'var(--accent-bg)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text)',
                      lineHeight: 1.4,
                    }}
                  >
                    {missionLoading ? (
                      <span className="skeleton" style={{ display: 'block', height: 14, width: '70%', borderRadius: 4 }} />
                    ) : (
                      <>
                        {scoreCoach.emoji} {scoreCoach.message}
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
