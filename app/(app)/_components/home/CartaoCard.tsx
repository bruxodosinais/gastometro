'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/calculations';
import { CreditCard as CreditCardType } from '@/lib/types';
import { anim, hidden } from './_anim';

type Props = {
  card: CreditCardType;
  fatura: number;
  mounted: boolean;
  onPagar: () => void;
};

export default function CartaoCard({ card, fatura, mounted, onPagar }: Props) {
  const limiteDisponivel = Math.max(0, card.limite - fatura);

  return (
    <div
      style={{
        margin: '16px 16px 0',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '14px 16px',
        boxShadow: 'var(--card-shadow)',
        ...(mounted ? anim(300) : hidden),
      }}
    >
      {/* Linha 1 — nome + link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            {card.nome}
          </p>
        </div>
        <Link href={`/cartoes/${card.id}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
          Ver detalhes →
        </Link>
      </div>

      {/* Linha 2 — fatura + status inline */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: fatura > 0 ? 'var(--red)' : 'var(--green-text)' }}>
          {formatCurrency(fatura)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>
          {fatura > 0 ? 'em aberto' : 'fatura zerada ✓'}
        </span>
      </div>

      {/* Linha 3 — limite + vencimento */}
      <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, marginBottom: fatura > 0 ? 10 : 0 }}>
        Limite disponível: {formatCurrency(limiteDisponivel)}
        {card.diaVencimento ? ` · Vence dia ${card.diaVencimento}` : ''}
      </p>

      {/* Botão pagar */}
      {fatura > 0 && (
        <button
          onClick={onPagar}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 'var(--r-sm)',
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Pagar fatura
        </button>
      )}
    </div>
  );
}
