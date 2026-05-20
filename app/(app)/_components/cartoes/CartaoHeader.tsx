import { Plus } from 'lucide-react';

interface Props {
  onAdd: () => void;
}

export default function CartaoHeader({ onAdd }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 16px', marginBottom: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Cartões</h1>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>Gerencie seus cartões de crédito</p>
      </div>
      <button
        onClick={onAdd}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--green)', color: 'white',
          fontSize: 12, fontWeight: 700,
          borderRadius: 20, border: 'none',
          padding: '6px 14px', cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Plus size={14} />
        Adicionar
      </button>
    </div>
  );
}
