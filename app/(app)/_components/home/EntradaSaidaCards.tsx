'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { formatCurrency, formatCompact } from '@/lib/calculations';
import { anim, hidden } from './_anim';

function AutoValue({
  value,
  className = '',
  style,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    setCompact(false);
  }, [value]);

  useLayoutEffect(() => {
    if (compact) return;
    const el = ref.current;
    if (el && el.scrollWidth > el.clientWidth) setCompact(true);
  });

  return (
    <p ref={ref} className={`whitespace-nowrap overflow-hidden ${className}`} style={style}>
      {compact ? formatCompact(value) : formatCurrency(value)}
    </p>
  );
}

type Props = {
  income: number;
  spent: number;
  mounted: boolean;
};

export default function EntradaSaidaCards({ income, spent, mounted }: Props) {
  return (
    <div
      style={{
        margin: '10px 16px 0',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        ...(mounted ? anim(200) : hidden),
      }}
    >
      {/* Entrou */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '14px 16px',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div
          className="eio-icon"
          style={{
            width: 32,
            height: 32,
            background: 'var(--green-bg)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            marginBottom: 8,
          }}
        >
          💰
        </div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 2,
          }}
        >
          ENTROU
        </p>
        <AutoValue
          value={income}
          style={{ fontSize: 19, fontWeight: 800, color: 'var(--green)', margin: 0 }}
        />
        <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>esse mês</p>
      </div>

      {/* Saiu */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '14px 16px',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div
          className="eio-icon"
          style={{
            width: 32,
            height: 32,
            background: 'var(--red-bg)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            marginBottom: 8,
          }}
        >
          💸
        </div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 2,
          }}
        >
          SAIU
        </p>
        <AutoValue
          value={spent}
          style={{ fontSize: 19, fontWeight: 800, color: 'var(--red)', margin: 0 }}
        />
        <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>lançados</p>
      </div>
    </div>
  );
}
