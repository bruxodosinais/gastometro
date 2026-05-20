import Link from 'next/link';
import { ChevronRight, CreditCard, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { CreditCard as CreditCardType } from '@/lib/types';
import { formatCurrency } from '@/lib/calculations';

interface Props {
  card: CreditCardType;
  fatura: number;
  period: string;
  isMenuOpen: boolean;
  onToggleMenu: (id: string | null) => void;
  onEdit: (card: CreditCardType) => void;
  onDelete: (card: CreditCardType) => void;
}

export default function CartaoCard({ card, fatura, period, isMenuOpen, onToggleMenu, onEdit, onDelete }: Props) {
  const fatPct = card.limite > 0 ? Math.min((fatura / card.limite) * 100, 100) : 0;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '16px 18px',
        margin: '0 16px',
        position: 'relative',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <Link
        href={`/cartoes/${card.id}`}
        style={{ position: 'absolute', inset: 0, borderRadius: 'var(--r)', zIndex: 0 }}
        aria-label={`Ver fatura ${card.nome}`}
      />

      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent-bg)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CreditCard size={16} color="var(--accent)" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{card.nome}</p>
            {(card.diaFechamento || card.diaVencimento) && (
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginTop: 1 }}>
                {card.diaFechamento ? `Fecha dia ${card.diaFechamento}` : ''}
                {card.diaFechamento && card.diaVencimento ? ' · ' : ''}
                {card.diaVencimento ? `Vence dia ${card.diaVencimento}` : ''}
              </p>
            )}
          </div>
        </div>
        <div style={{ position: 'relative', flexShrink: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
          <ChevronRight size={15} color="var(--border)" aria-hidden="true" />
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMenu(isMenuOpen ? null : card.id); }}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            aria-label="Opções"
          >
            <MoreVertical size={15} />
          </button>
          {isMenuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden', minWidth: 120 }}>
              <button onClick={() => { onEdit(card); onToggleMenu(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Pencil size={12} /> Editar
              </button>
              <button onClick={() => { onDelete(card); onToggleMenu(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid var(--border-2)' }}>
                <Trash2 size={12} /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fatura */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
          Fatura {period.slice(5, 7)}/{period.slice(0, 4)}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: fatura > 0 ? 'var(--red)' : 'var(--text)' }}>
          {formatCurrency(fatura)}
        </span>
      </div>

      {/* Barra de limite */}
      <div style={{ height: 4, background: 'var(--red-bg)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${fatPct}%`, background: 'var(--red)', transition: 'width 400ms ease' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)' }}>
          {Math.round(fatPct)}% do limite utilizado
        </p>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Ver lançamentos →</p>
      </div>
    </div>
  );
}
