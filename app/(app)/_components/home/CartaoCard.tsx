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
        padding: '18px 20px',
        boxShadow: 'var(--card-shadow)',
        ...(mounted ? anim(300) : hidden),
      }}
    >
      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Cartão
        </p>
        <Link
          href={`/cartoes/${card.id}`}
          style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
        >
          Ver detalhes →
        </Link>
      </div>

      {/* Nome do cartão */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
            flexShrink: 0,
          }}
        />
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          {card.nome}
        </p>
      </div>

      {/* Fatura atual */}
      <div style={{ marginBottom: 14 }}>
        <p
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: fatura > 0 ? '#f04e5e' : 'var(--green-text)',
            margin: 0,
            lineHeight: 1,
          }}
        >
          {formatCurrency(fatura)}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
          {fatura > 0 ? 'em aberto' : 'fatura zerada ✓'}
        </p>
      </div>

      {/* Separador */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

      {/* Infos secundárias */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: fatura > 0 ? 14 : 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
          Limite disponível: {formatCurrency(limiteDisponivel)}
        </p>
        {card.diaVencimento && (
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
            Vence dia {card.diaVencimento}
          </p>
        )}
      </div>

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
