'use client';

import LoadingButton from '@/components/ui/LoadingButton';
import CurrencyInput from '@/components/CurrencyInput';
import { getMonthLabel } from '@/lib/calculations';

// Modal do PLANO DO MÊS (renda esperada + meta de poupança) — é ele que define
// o "Orçamento livre do mês". Vive aqui, e não dentro de HomeModals, porque a
// Home e a tela /orcamentos abrem exatamente o mesmo formulário; duplicar
// significaria dois campos "renda" que envelhecem separados.
type Props = {
  open: boolean;
  /** YYYY-MM do período sendo editado. */
  period: string;
  income: number;
  goal: number;
  onIncomeChange: (v: number) => void;
  onGoalChange: (v: number) => void;
  error: string;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export default function PlanoMensalModal({
  open,
  period,
  income,
  goal,
  onIncomeChange,
  onGoalChange,
  error,
  saving,
  onCancel,
  onSave,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ padding: 16 }}
      onClick={() => !saving && onCancel()}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          width: '90%',
          maxWidth: 400,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
          Definir orçamento
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          {getMonthLabel(period)}
        </p>

        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-2)',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Renda esperada (R$)
        </label>
        <CurrencyInput
          autoFocus
          value={income}
          onChange={onIncomeChange}
          placeholder="0,00"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            outline: 'none',
            marginBottom: 14,
          }}
        />

        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-2)',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Meta de poupança (R$){' '}
          <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· opcional</span>
        </label>
        <CurrencyInput
          value={goal}
          onChange={onGoalChange}
          placeholder="0,00"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            outline: 'none',
            marginBottom: 14,
          }}
        />

        {error && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--red)',
              background: 'var(--red-bg)',
              borderRadius: 'var(--r-sm)',
              padding: '10px 14px',
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <LoadingButton
            onClick={onSave}
            loading={saving}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              background: 'var(--accent)',
              border: 'none',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            Salvar
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
