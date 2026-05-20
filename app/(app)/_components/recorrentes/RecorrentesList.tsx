'use client';

import type { RecurringExpense } from '@/lib/types';
import RecorrenteCard, { type RecorrenteCardSharedProps } from './RecorrenteCard';

export type RecorrentesTab = 'all' | 'pendentes' | 'pagas';

type Props = {
  recurringsLength: number;
  filteredLength: number;
  expenseRecs: RecurringExpense[];
  incomeRecs: RecurringExpense[];
  activeTab: RecorrentesTab;
  tabExpanded: { all: boolean; pendentes: boolean; pagas: boolean };
  onExpandTab: (tab: RecorrentesTab) => void;
  onCollapseTab: (tab: RecorrentesTab) => void;
  cardProps: RecorrenteCardSharedProps;
};

export default function RecorrentesList({
  recurringsLength,
  filteredLength,
  expenseRecs,
  incomeRecs,
  activeTab,
  tabExpanded,
  onExpandTab,
  onCollapseTab,
  cardProps,
}: Props) {
  if (recurringsLength === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>🔄</p>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Nenhuma conta fixa cadastrada
        </p>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', maxWidth: 280, margin: '0 auto' }}>
          Cadastre contas que se repetem todo mês — aluguel, streaming, academia — e nunca perca um vencimento.
        </p>
      </div>
    );
  }

  if (filteredLength === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>
        Nenhum item nesta categoria
      </p>
    );
  }

  const MAX = 5;
  const isExpanded = tabExpanded[activeTab];
  // BUG 2: receitas fixas também aparecem nas abas Pendentes e
  // Pagas / Recebidas (não só em "Ver tudo").
  const totalCount = expenseRecs.length + incomeRecs.length;
  const expenseBudget = isExpanded
    ? expenseRecs.length
    : Math.min(expenseRecs.length, MAX);
  const incomeBudget = isExpanded
    ? incomeRecs.length
    : Math.max(0, MAX - expenseBudget);
  const visibleExpense = expenseRecs.slice(0, expenseBudget);
  const visibleIncome = incomeRecs.slice(0, incomeBudget);
  const hiddenCount = totalCount - (visibleExpense.length + visibleIncome.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Gastos fixos */}
      {visibleExpense.length > 0 && (
        <>
          {activeTab === 'all' && (
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
              Gastos fixos
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: visibleIncome.length > 0 ? 16 : 0 }}>
            {visibleExpense.map((rec) => (
              <RecorrenteCard key={rec.id} rec={rec} {...cardProps} />
            ))}
          </div>
        </>
      )}

      {/* Receitas fixas */}
      {visibleIncome.length > 0 && (
        <>
          {activeTab === 'all' && (
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
              Receitas fixas
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleIncome.map((rec) => (
              <RecorrenteCard key={rec.id} rec={rec} {...cardProps} />
            ))}
          </div>
        </>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => onExpandTab(activeTab)}
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          Ver mais {hiddenCount} {hiddenCount === 1 ? 'item' : 'itens'} →
        </button>
      )}
      {isExpanded && totalCount > MAX && (
        <button
          type="button"
          onClick={() => onCollapseTab(activeTab)}
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-3)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          Ver menos
        </button>
      )}
    </div>
  );
}
