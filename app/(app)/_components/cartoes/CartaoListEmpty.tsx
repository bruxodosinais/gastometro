import { Plus } from 'lucide-react';

interface Props {
  onAdd: () => void;
}

export default function CartaoListEmpty({ onAdd }: Props) {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center' }}>
      <p style={{ fontSize: 48, marginBottom: 12 }}>💳</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Nenhum cartão cadastrado</p>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginBottom: 20, maxWidth: 260, margin: '0 auto 20px' }}>
        Adicione seus cartões de crédito para controlar as faturas mensais.
      </p>
      <button
        onClick={onAdd}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, borderRadius: 'var(--r-sm)', border: 'none', padding: '10px 20px', cursor: 'pointer' }}
      >
        <Plus size={15} />
        Adicionar cartão
      </button>
    </div>
  );
}
