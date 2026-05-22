'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { anim, hidden } from './_anim';

type Props = {
  debitBalance: number;
  income: number;
  spent: number;
  faturasTotal: number;
  faturaHref: string;
  mode: 'current' | 'past' | 'future';
  periodLabel: string;
  mounted: boolean;
};

export default function SaldoCard({
  debitBalance,
  income,
  spent,
  faturasTotal,
  faturaHref,
  mode,
  periodLabel,
  mounted,
}: Props) {
  const monthResult = income - spent;
  const positive = monthResult >= 0;
  const subtitleColor =
    mode === 'current'
      ? positive
        ? '#A6F5D5'
        : '#FFB3B3'
      : 'rgba(255,255,255,0.7)';

  return (
    <div
      style={{
        margin: '12px 16px 0',
        background: 'var(--accent)',
        borderRadius: 'var(--r)',
        padding: '22px 20px 20px',
        boxShadow: '0 8px 24px var(--accent-shadow)',
        position: 'relative',
        overflow: 'hidden',
        ...(mounted ? anim(150) : hidden),
      }}
    >
      {/* decorative circles */}
      <div
        style={{
          position: 'absolute',
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          top: -40,
          right: -30,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          bottom: -20,
          left: 30,
          pointerEvents: 'none',
        }}
      />

      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.6)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 4,
          position: 'relative',
        }}
      >
        SALDO EM CONTA
      </p>
      <p
        style={{
          fontSize: 40,
          fontWeight: 900,
          color: 'white',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: 6,
          position: 'relative',
        }}
      >
        {formatCurrency(debitBalance)}
      </p>

      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: subtitleColor,
          marginBottom: 14,
          position: 'relative',
        }}
      >
        {mode === 'current'
          ? `resultado do mês: ${positive ? '' : '−'}${formatCurrency(Math.abs(monthResult))}`
          : mode === 'past'
          ? `saldo em ${periodLabel}`
          : `projeção para ${periodLabel}`}
      </p>

      {faturasTotal > 0 && (
        <>
          <div
            style={{
              height: 1,
              background: 'rgba(255,255,255,0.15)',
              marginBottom: 12,
              position: 'relative',
            }}
          />
          <Link
            href={faturaHref}
            aria-label="Ver faturas dos cartões"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              textDecoration: 'none',
              color: 'inherit',
              cursor: 'pointer',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Fatura atual</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                fontWeight: 600,
                color: '#FFB3B3',
              }}
            >
              −{formatCurrency(faturasTotal)}
              <ChevronRight size={14} color="rgba(255,255,255,0.55)" aria-hidden="true" />
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
