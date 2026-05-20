'use client';

import LoadingButton from '@/components/ui/LoadingButton';
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import type { CreditCard as CreditCardType } from '@/lib/types';

type VariablePayModalState = { obligationId: string; estimatedAmount: number } | null;
type CardVencimentoAlertState = { card: CreditCardType; fatura: number } | null;

type Props = {
  // Variable-pay modal
  variablePayModal: VariablePayModalState;
  variableAmount: string;
  onVariableAmountChange: (v: string) => void;
  onCancelVariablePay: () => void;
  onConfirmVariablePay: () => void;

  // Budget modal
  budgetModalOpen: boolean;
  budgetIncomeInput: string;
  budgetGoalInput: string;
  onBudgetIncomeChange: (v: string) => void;
  onBudgetGoalChange: (v: string) => void;
  budgetError: string;
  savingBudget: boolean;
  onCancelBudget: () => void;
  onSaveBudget: () => void;
  period: string;

  // Card vencimento alert
  cardVencimentoAlert: CardVencimentoAlertState;
  onDismissCardAlert: () => void;
  onPayFatura: (card: CreditCardType, total: number) => void;
};

export default function HomeModals({
  variablePayModal,
  variableAmount,
  onVariableAmountChange,
  onCancelVariablePay,
  onConfirmVariablePay,
  budgetModalOpen,
  budgetIncomeInput,
  budgetGoalInput,
  onBudgetIncomeChange,
  onBudgetGoalChange,
  budgetError,
  savingBudget,
  onCancelBudget,
  onSaveBudget,
  period,
  cardVencimentoAlert,
  onDismissCardAlert,
  onPayFatura,
}: Props) {
  return (
    <>
      {/* ── MODAL: Valor real para despesa variável ──────────────────────────── */}
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
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              Confirmar pagamento
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
              Valor estimado: {formatCurrency(variablePayModal.estimatedAmount)} — informe o
              valor real pago
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
              Valor pago (R$)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus
              value={variableAmount}
              onChange={(e) => onVariableAmountChange(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onCancelVariablePay}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
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

      {/* ── MODAL: Configurar orçamento (P5) ─────────────────────────────────── */}
      {budgetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          style={{ padding: 16 }}
          onClick={() => !savingBudget && onCancelBudget()}
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
              Configurar orçamento
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
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus
              value={budgetIncomeInput}
              onChange={(e) => onBudgetIncomeChange(e.target.value)}
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
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={budgetGoalInput}
              onChange={(e) => onBudgetGoalChange(e.target.value)}
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

            {budgetError && (
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
                {budgetError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onCancelBudget}
                disabled={savingBudget}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingBudget ? 'default' : 'pointer',
                  opacity: savingBudget ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
              <LoadingButton
                onClick={onSaveBudget}
                loading={savingBudget}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: savingBudget ? 'default' : 'pointer',
                  opacity: savingBudget ? 0.7 : 1,
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
      )}

      {/* ── MODAL: Fatura vence hoje ─────────────────────────────────────────── */}
      {cardVencimentoAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 360,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              💳 Fatura do {cardVencimentoAlert.card.nome} vence hoje
            </p>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-2)',
                marginBottom: 20,
              }}
            >
              {formatCurrency(cardVencimentoAlert.fatura)} — deseja registrar o pagamento?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onDismissCardAlert}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Lembrar depois
              </button>
              <button
                onClick={() =>
                  onPayFatura(cardVencimentoAlert.card, cardVencimentoAlert.fatura)
                }
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Pagar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
