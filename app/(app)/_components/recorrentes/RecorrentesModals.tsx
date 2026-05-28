'use client';

import LoadingButton from '@/components/ui/LoadingButton';
import CurrencyInput from '@/components/CurrencyInput';
import { formatCurrency } from '@/lib/calculations';
import type { RecurringExpense } from '@/lib/types';
import { fieldLabelStyle, fieldStyle, Switch } from './_shared';

export type VariablePayModalState = { obligationId: string; estimatedAmount: number } | null;

type Props = {
  // Variable pay modal
  variablePayModal: VariablePayModalState;
  variableAmount: number;
  onVariableAmountChange: (v: number) => void;
  onCancelVariablePay: () => void;
  onConfirmVariablePay: () => void;

  // Edit modal
  editingRec: RecurringExpense | null;
  editDesc: string;
  onEditDescChange: (v: string) => void;
  editAmount: number;
  onEditAmountChange: (v: number) => void;
  editDayOfMonth: string;
  onEditDayOfMonthChange: (v: string) => void;
  editDueDay: string;
  onEditDueDayChange: (v: string) => void;
  editIsVariable: boolean;
  onEditIsVariableToggle: () => void;
  editHasDuration: boolean;
  onEditHasDurationToggle: () => void;
  editTotalInstallments: string;
  onEditTotalInstallmentsChange: (v: string) => void;
  editSaving: boolean;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
};

export default function RecorrentesModals({
  variablePayModal,
  variableAmount,
  onVariableAmountChange,
  onCancelVariablePay,
  onConfirmVariablePay,
  editingRec,
  editDesc,
  onEditDescChange,
  editAmount,
  onEditAmountChange,
  editDayOfMonth,
  onEditDayOfMonthChange,
  editDueDay,
  onEditDueDayChange,
  editIsVariable,
  onEditIsVariableToggle,
  editHasDuration,
  onEditHasDurationToggle,
  editTotalInstallments,
  onEditTotalInstallmentsChange,
  editSaving,
  onCancelEdit,
  onSaveEdit,
}: Props) {
  return (
    <>
      {/* ── MODAL: Valor variável ────────────────────────────────────────────── */}
      {variablePayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          style={{ padding: 16 }}
          onClick={onCancelVariablePay}
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
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Confirmar pagamento
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
              Valor estimado: {formatCurrency(variablePayModal.estimatedAmount)} — informe o valor real pago
            </p>
            <label style={fieldLabelStyle}>Valor pago (R$)</label>
            <CurrencyInput
              autoFocus
              value={variableAmount}
              onChange={onVariableAmountChange}
              style={{ ...fieldStyle, fontSize: 18, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onCancelVariablePay}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirmVariablePay}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Editar recorrente ─────────────────────────────────────────── */}
      {editingRec && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          style={{ padding: 16 }}
          onClick={onCancelEdit}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              width: '100%',
              maxWidth: 380,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              Editar recorrente
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={fieldLabelStyle}>Descrição</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => onEditDescChange(e.target.value)}
                  placeholder="Ex: Netflix, Academia, Aluguel..."
                  maxLength={80}
                  autoFocus
                  style={{ ...fieldStyle }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={fieldLabelStyle}>Valor (R$)</label>
                  <CurrencyInput
                    value={editAmount}
                    onChange={onEditAmountChange}
                    style={{ ...fieldStyle }}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Dia lançamento</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    value={editDayOfMonth}
                    onChange={(e) => onEditDayOfMonthChange(e.target.value)}
                    style={{ ...fieldStyle }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={fieldLabelStyle}>Dia vencimento</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    value={editDueDay}
                    onChange={(e) => onEditDueDayChange(e.target.value)}
                    placeholder={editDayOfMonth || '—'}
                    style={{ ...fieldStyle }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ ...fieldLabelStyle, marginBottom: 10 }}>Valor variável</label>
                  <Switch
                    on={editIsVariable}
                    onToggle={onEditIsVariableToggle}
                    ariaLabel="Valor variável"
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                      Tem duração definida?
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                      {editHasDuration ? 'Para de aparecer ao terminar as parcelas' : 'Recorrente sem prazo (padrão)'}
                    </p>
                  </div>
                  <Switch
                    on={editHasDuration}
                    onToggle={onEditHasDurationToggle}
                    ariaLabel="Tem duração definida?"
                  />
                </div>
                {editHasDuration && (
                  <div style={{ marginTop: 10 }}>
                    <label style={fieldLabelStyle}>Número de parcelas</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={editTotalInstallments}
                      onChange={(e) => onEditTotalInstallmentsChange(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Ex: 12"
                      style={{ ...fieldStyle }}
                    />
                    <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
                      Ex: 12x para um financiamento de 1 ano
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={onCancelEdit}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <LoadingButton
                onClick={onSaveEdit}
                loading={editSaving}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: editSaving ? 0.7 : 1,
                }}
              >
                Salvar
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
