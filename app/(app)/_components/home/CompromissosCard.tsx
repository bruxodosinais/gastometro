'use client';

import { formatCurrency } from '@/lib/calculations';
import { anim, hidden } from './_anim';

type Props = {
  fixedTotal: number;
  debtTotal: number;
  variableTotal: number;
  income: number;
  mounted: boolean;
};

const FIXED_COLOR = '#6B7280';
const DEBT_COLOR = '#FFB800';
const VARIABLE_COLOR = '#5B5BD6';

export default function CompromissosCard({
  fixedTotal,
  debtTotal,
  variableTotal,
  income,
  mounted,
}: Props) {
  const compromised = fixedTotal + debtTotal;
  // Quando não há renda configurada/lançada, a barra fica zerada (sem
  // referência) — ainda exibimos os totais, mas sem % "de R$ X".
  const hasIncome = income > 0;
  const pct = hasIncome ? Math.min((compromised / income) * 100, 100) : 0;
  const overCommitted = hasIncome && compromised > income;
  const barColor = overCommitted ? 'var(--red)' : pct >= 80 ? DEBT_COLOR : 'var(--accent)';

  return (
    <div
      style={{
        margin: '10px 16px 0',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '18px 20px',
        boxShadow: 'var(--card-shadow)',
        ...(mounted ? anim(325) : hidden),
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          COMPROMISSOS DO MÊS
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Row
          icon="🔒"
          label="Fixas"
          hint="recorrentes sem prazo"
          value={fixedTotal}
          dotColor={FIXED_COLOR}
        />
        <Row
          icon="📅"
          label="Dívidas"
          hint="parcelamentos / financiamentos"
          value={debtTotal}
          dotColor={DEBT_COLOR}
        />
        <Row
          icon="🎯"
          label="Variáveis"
          hint="gastos avulsos do mês"
          value={variableTotal}
          dotColor={VARIABLE_COLOR}
        />
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--border-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
            Total comprometido
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: overCommitted ? 'var(--red)' : 'var(--text)',
            }}
          >
            {formatCurrency(compromised)}
          </span>
        </div>
        {hasIncome ? (
          <>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--text-3)',
                margin: 0,
                marginBottom: 8,
              }}
            >
              {formatCurrency(compromised)} comprometidos de {formatCurrency(income)} de renda
            </p>
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
                  width: mounted ? `${pct}%` : '0%',
                  background: barColor,
                  borderRadius: 3,
                  transition: 'width 600ms ease',
                }}
              />
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: overCommitted ? 'var(--red)' : 'var(--text-3)',
                marginTop: 6,
                marginBottom: 0,
              }}
            >
              {Math.round(pct)}% da renda{overCommitted ? ' — acima do limite' : ''}
            </p>
          </>
        ) : (
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-3)',
              margin: 0,
            }}
          >
            Configure sua renda para ver a % de comprometimento.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  value,
  dotColor,
}: {
  icon: string;
  label: string;
  hint: string;
  value: number;
  dotColor: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          {label}
        </p>
        <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', margin: 0 }}>
          {hint}
        </p>
      </div>
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: 'var(--text)',
          whiteSpace: 'nowrap',
        }}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
