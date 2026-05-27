'use client';

import { startTransition } from 'react';
import { AlertCircle, ChevronDown, Loader2 } from 'lucide-react';
import UpgradeBanner from '@/components/UpgradeBanner';
import { formatCurrency } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import type {
  CreditCard as CreditCardType,
  EntryType,
  RecurringExpense,
} from '@/lib/types';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { fieldLabelStyle, fieldStyle, Switch } from './_shared';

export type RecorrentesTab = 'all' | 'pendentes' | 'pagas';

type Props = {
  // Layout
  isFormOpen: boolean;
  onToggleForm: () => void;

  // Pro block (entry-block when limit reached)
  atRecurringsLimit: boolean;

  // Form values
  entryType: EntryType;
  amount: string;
  description: string;
  category: string;
  dayOfMonth: string;
  dueDay: string;
  isVariable: boolean;
  hasDuration: boolean;
  totalInstallments: string;
  isCredit: boolean;
  selectedCardId: string;
  creditCards: CreditCardType[];
  saving: boolean;
  descricaoError: string;
  formError: string | null;
  inputFocused: boolean;
  duplicateWarning: RecurringExpense | null;

  // Form callbacks
  onTypeChange: (type: EntryType) => void;
  onAmountChange: (v: string) => void;
  onAmountFocus: (current: string) => void;
  onAmountBlur: () => void;
  onDescriptionChange: (v: string) => void;
  onDayOfMonthChange: (v: string) => void;
  onDueDayChange: (v: string) => void;
  onToggleVariable: () => void;
  onToggleDuration: () => void;
  onTotalInstallmentsChange: (v: string) => void;
  onToggleCredit: () => void;
  onSelectedCardChange: (id: string) => void;
  onOpenCategoryPicker: () => void;
  onClearDuplicate: () => void;
  onDismissDuplicate: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export default function RecorrentesHeader({
  isFormOpen,
  onToggleForm,
  atRecurringsLimit,
  entryType,
  amount,
  description,
  category,
  dayOfMonth,
  dueDay,
  isVariable,
  hasDuration,
  totalInstallments,
  isCredit,
  selectedCardId,
  creditCards,
  saving,
  descricaoError,
  formError,
  inputFocused,
  duplicateWarning,
  onTypeChange,
  onAmountChange,
  onAmountFocus,
  onAmountBlur,
  onDescriptionChange,
  onDayOfMonthChange,
  onDueDayChange,
  onToggleVariable,
  onToggleDuration,
  onTotalInstallmentsChange,
  onToggleCredit,
  onSelectedCardChange,
  onOpenCategoryPicker,
  onClearDuplicate,
  onDismissDuplicate,
  onSubmit,
}: Props) {
  const hasAmount = amount !== '' && amount !== '0';
  const typeColor = entryType === 'income' ? 'var(--green)' : 'var(--red)';
  const { categories: customs } = useCustomCategories();

  return (
    <>
      <button
        type="button"
        onClick={onToggleForm}
        aria-expanded={isFormOpen}
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: 'var(--surface)',
          border: '1.5px solid var(--accent)',
          borderRadius: 'var(--r)',
          padding: '12px 44px',
          marginBottom: isFormOpen ? 10 : 24,
          cursor: 'pointer',
          fontFamily: 'Nunito, sans-serif',
          textAlign: 'center',
          transition: 'margin-bottom 0.25s ease',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
          + Novo recorrente
        </span>
        <ChevronDown
          size={18}
          color="var(--accent)"
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: isFormOpen
              ? 'translateY(-50%) rotate(180deg)'
              : 'translateY(-50%) rotate(0deg)',
            transition: 'transform 0.25s ease',
          }}
        />
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: isFormOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s ease',
          marginBottom: isFormOpen ? 24 : 0,
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>

          {atRecurringsLimit ? (
            <UpgradeBanner
              variant="fullpage"
              feature="recorrentes"
              message="Você atingiu o limite de 5 recorrentes do plano gratuito. Com o Pro, cadastre quantos quiser."
            />
          ) : (
          <form
            onSubmit={onSubmit}
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* 1. TOGGLE GASTO / RECEITA */}
            <div
              style={{
                display: 'flex',
                padding: 4,
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg)',
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={() => onTypeChange('expense')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  ...(entryType === 'expense'
                    ? { background: 'var(--red)', color: 'white', boxShadow: '0 1px 4px rgba(255,71,87,0.25)' }
                    : { background: 'transparent', color: 'var(--text-2)' }),
                }}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => onTypeChange('income')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  ...(entryType === 'income'
                    ? { background: 'var(--green)', color: 'white', boxShadow: '0 1px 4px rgba(0,195,122,0.25)' }
                    : { background: 'transparent', color: 'var(--text-2)' }),
                }}
              >
                Receita
              </button>
            </div>

            {/* 2. VALOR HERO */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 0 18px',
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: hasAmount ? typeColor : 'var(--text-3)',
                  opacity: hasAmount ? 0.6 : 1,
                  transition: 'color 0.2s ease',
                  userSelect: 'none',
                }}
              >
                R$
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  onFocus={(e) => onAmountFocus(e.target.value)}
                  onBlur={onAmountBlur}
                  placeholder="0"
                  required
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    fontFamily: 'Nunito, sans-serif',
                    letterSpacing: '-0.03em',
                    color: hasAmount ? typeColor : 'var(--text)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    textAlign: 'center',
                    width: 200,
                    paddingBottom: 6,
                    transition: 'color 200ms ease',
                    caretColor: typeColor,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: typeColor,
                    borderRadius: 1,
                    opacity: inputFocused ? 1 : 0.45,
                    transition: 'opacity 0.2s ease, background 0.2s ease',
                  }}
                />
              </div>
            </div>

            {/* 3. TOGGLE VALOR VARIÁVEL */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  Valor variável
                </p>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                  {isVariable ? 'Valor acima é estimado — você define o real ao pagar' : 'Valor fixo todo mês'}
                </p>
              </div>
              <Switch on={isVariable} onToggle={onToggleVariable} ariaLabel="Valor variável" />
            </div>

            {/* 3b. TOGGLE DURAÇÃO DEFINIDA */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    Tem duração definida?
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                    {hasDuration ? 'Para de aparecer ao terminar as parcelas' : 'Recorrente sem prazo (padrão)'}
                  </p>
                </div>
                <Switch on={hasDuration} onToggle={onToggleDuration} ariaLabel="Tem duração definida?" />
              </div>
              {hasDuration && (
                <div style={{ marginTop: 10 }}>
                  <label style={fieldLabelStyle}>Número de parcelas</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={totalInstallments}
                    onChange={(e) => onTotalInstallmentsChange(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Ex: 12"
                    style={{ ...fieldStyle }}
                  />
                  <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
                    Ex: 12x para um financiamento de 1 ano
                  </p>
                </div>
              )}
            </div>

            {/* 4. TOGGLE CARTÃO DE CRÉDITO */}
            {entryType === 'expense' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                      Pagar no cartão
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                      {isCredit ? 'Cobrado na fatura do cartão' : 'Débito / dinheiro'}
                    </p>
                  </div>
                  <Switch on={isCredit} onToggle={onToggleCredit} ariaLabel="Pagar no cartão" />
                </div>
                {isCredit && creditCards.length > 0 && (
                  <select
                    value={selectedCardId}
                    onChange={(e) => onSelectedCardChange(e.target.value)}
                    style={{ ...fieldStyle, marginTop: 8 }}
                  >
                    {creditCards.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                )}
                {isCredit && creditCards.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                    Nenhum cartão cadastrado.{' '}
                    <a href="/cartoes" style={{ color: 'var(--accent)' }}>Adicionar →</a>
                  </p>
                )}
              </div>
            )}

            {/* 5. DESCRIÇÃO */}
            <div>
              <label style={fieldLabelStyle}>Descrição</label>
              <input
                id="campo-descricao"
                type="text"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder={
                  entryType === 'expense'
                    ? 'Ex: Netflix, Academia, Aluguel...'
                    : 'Ex: Salário, Freela mensal...'
                }
                maxLength={80}
                style={{
                  ...fieldStyle,
                  borderColor: descricaoError ? 'var(--red)' : 'var(--border)',
                }}
              />
              {descricaoError && (
                <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{descricaoError}</p>
              )}
              {duplicateWarning && (
                <div
                  style={{
                    marginTop: 8,
                    background: 'var(--yellow-bg)',
                    border: '1.5px solid rgba(255,184,0,0.25)',
                    borderRadius: 'var(--r-sm)',
                    padding: '10px 14px',
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--yellow-text)', margin: 0 }}>
                    ⚠️ Já existe um recorrente similar:{' '}
                    <strong>{duplicateWarning.description} ({formatCurrency(duplicateWarning.amount)})</strong>.
                    {' '}Deseja cadastrar mesmo assim?
                  </p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={onClearDuplicate}
                      style={{ fontSize: 11, color: 'var(--yellow-text)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={onDismissDuplicate}
                      style={{ fontSize: 11, color: 'var(--yellow-text)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Cadastrar mesmo assim
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 6. DIA DE LANÇAMENTO + DIA DE VENCIMENTO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={fieldLabelStyle}>Dia de lançamento</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => onDayOfMonthChange(e.target.value)}
                  placeholder="Ex: 1"
                  style={{ ...fieldStyle }}
                />
                <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
                  Quando aparece no histórico
                </p>
              </div>
              <div>
                <label style={fieldLabelStyle}>Dia de vencimento</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => onDueDayChange(e.target.value)}
                  placeholder="Ex: 10"
                  style={{ ...fieldStyle }}
                />
                <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
                  Limite para pagar sem atraso
                </p>
              </div>
            </div>

            {/* 7. CATEGORIA */}
            <div>
              <label style={fieldLabelStyle}>Categoria</label>
              <button
                type="button"
                onClick={onOpenCategoryPicker}
                style={{
                  ...fieldStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                  {getCategoryDisplay(category, customs).icon}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {category}
                </span>
                <ChevronDown size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
              </button>
            </div>

            {/* ERRO */}
            {formError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--red-bg)',
                  border: '1.5px solid rgba(255,71,87,0.2)',
                  borderRadius: 'var(--r-sm)',
                  padding: '11px 14px',
                  color: 'var(--red)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {formError}
              </div>
            )}

            {/* CTA */}
            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 800,
                fontFamily: 'Nunito, sans-serif',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: saving ? 0.7 : 1,
                transition: 'opacity 0.2s ease',
                boxShadow: '0 4px 12px var(--accent-shadow)',
              }}
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : 'Cadastrar recorrente'}
            </button>
          </form>
          )}
        </div>
      </div>
    </>
  );
}

export function RecorrentesTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: RecorrentesTab;
  onTabChange: (tab: RecorrentesTab) => void;
}) {
  const labels: Record<RecorrentesTab, string> = {
    all: 'Ver tudo',
    pendentes: 'Pendentes',
    pagas: 'Pagas / Recebidas',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
      {(['all', 'pendentes', 'pagas'] as const).map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => startTransition(() => onTabChange(tab))}
            style={{
              paddingBottom: 4,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Nunito, sans-serif',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-3)',
              cursor: 'pointer',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
          >
            {labels[tab]}
          </button>
        );
      })}
    </div>
  );
}
