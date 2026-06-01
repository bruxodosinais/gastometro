'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { getRecurringExpenses, getExpenses } from '@/lib/storage';
import { getErrorMessage } from '@/lib/errors';
import { retryAsync } from '@/lib/retry';
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import { computeForecast } from '@/lib/forecast';
import type { ForecastResult } from '@/lib/forecast';
import type { Expense, RecurringExpense } from '@/lib/types';

export default function PrevisoesPage() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<ForecastResult | null>(null);

  function load() {
    setLoadError(null);
    retryAsync(() =>
      Promise.all([
        getRecurringExpenses() as Promise<RecurringExpense[]>,
        getExpenses() as Promise<Expense[]>,
      ])
    )
      .then(([recs, exps]) => {
        setResult(computeForecast(recs, exps, new Date(), 12));
        setReady(true);
      })
      .catch((err) => {
        setLoadError(getErrorMessage(err));
        setReady(true);
      });
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-28">
        <div className="skeleton h-7 w-48 rounded-lg mb-2" />
        <div className="skeleton h-4 w-72 rounded mb-8" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-20 rounded-xl" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-14 rounded-xl mb-2" />
        ))}
      </main>
    );
  }

  // ── Erro ───────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <main
        style={{
          maxWidth: 440, margin: '0 auto', padding: '64px 24px 40px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 16, textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 48 }}>😕</p>
        <p style={{ color: 'var(--text-2)', fontWeight: 600 }}>{loadError}</p>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--accent)', color: 'white',
            fontSize: 14, fontWeight: 700, padding: '10px 20px',
            borderRadius: 12, border: 'none', cursor: 'pointer',
          }}
        >
          <RefreshCw size={15} />
          Tentar novamente
        </button>
      </main>
    );
  }

  // ── Vazio ──────────────────────────────────────────────────────────────────
  if (!result?.hasData) {
    return (
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-28">
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px' }}>
          Previsões Financeiras
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '0 0 40px' }}>
          Projeção dos próximos 12 meses baseada nas suas contas fixas.
        </p>
        <div
          style={{
            textAlign: 'center', padding: '48px 24px',
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 'var(--r)',
          }}
        >
          <p style={{ fontSize: 40, marginBottom: 12 }}>📅</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Nenhuma conta fixa cadastrada
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.5 }}>
            Cadastre suas contas fixas para ver a projeção dos próximos 12 meses.
          </p>
          <Link
            href="/recorrentes"
            style={{
              display: 'inline-block', background: 'var(--accent)', color: '#fff',
              fontWeight: 800, fontSize: 14, padding: '12px 24px',
              borderRadius: 12, textDecoration: 'none',
            }}
          >
            Adicionar recorrente
          </Link>
        </div>
      </main>
    );
  }

  const { monthlyIncome, months } = result;
  const firstMonth = months[0];
  // Parcelados ativos fazem firstMonth.expense > result.monthlyExpense
  const hasInstallments = firstMonth.expense > result.monthlyExpense;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-28">
      <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px' }}>
        Previsões Financeiras
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '0 0 20px' }}>
        Projeção dos próximos 12 meses baseada nas suas contas fixas.
      </p>

      {/* ── Cards de resumo ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <SummaryCard
          label="Receita fixa/mês"
          value={formatCurrency(monthlyIncome)}
          valueColor="var(--green)"
        />
        <SummaryCard
          label="Custo deste mês"
          value={formatCurrency(firstMonth.expense)}
          valueColor="var(--red)"
          hint={hasInstallments ? 'inclui parcelamentos em andamento' : undefined}
        />
        <SummaryCard
          label="Saldo deste mês"
          value={`${firstMonth.balance >= 0 ? '+' : ''}${formatCurrency(firstMonth.balance)}`}
          valueColor={firstMonth.balance >= 0 ? 'var(--green)' : 'var(--red)'}
        />
      </div>

      {/* ── Lista dos 12 meses ──────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r)',
          overflow: 'hidden',
        }}
      >
        {months.map((m, idx) => {
          const label = getMonthLabel(m.monthKey);
          const balancePositive = m.balance >= 0;
          const cumulativePositive = m.cumulative >= 0;

          return (
            <div
              key={m.monthKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 16px',
                borderTop: idx === 0 ? 'none' : '1px solid var(--border-2)',
              }}
            >
              {/* Mês */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  {label}
                </p>
                {/* Mini-barra proporcional receita/despesa */}
                {(m.income > 0 || m.expense > 0) && (
                  <div
                    style={{
                      marginTop: 6,
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--border-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, m.income > 0 ? (m.expense / m.income) * 100 : 100)}%`,
                        background: balancePositive ? 'var(--accent)' : 'var(--red)',
                        borderRadius: 2,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Saldo do mês + acumulado */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: balancePositive ? 'var(--green)' : 'var(--red)',
                    margin: 0,
                  }}
                >
                  {balancePositive ? '+' : ''}{formatCurrency(m.balance)}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
                  Acumulado:{' '}
                  <span style={{ color: cumulativePositive ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                    {formatCurrency(m.cumulative)}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Nota de rodapé ──────────────────────────────────────────────── */}
      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 16, lineHeight: 1.6 }}>
        Projeção baseada em recorrentes ativas. Parcelamentos e financiamentos são
        considerados apenas até a última parcela. Gastos variáveis usam o valor
        cadastrado como estimativa.
      </p>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  valueColor,
  hint,
}: {
  label: string;
  value: string;
  valueColor: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '14px 14px',
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ fontSize: 16, fontWeight: 900, color: valueColor, margin: 0 }}>
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 0 0' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
