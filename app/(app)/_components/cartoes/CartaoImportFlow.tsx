import { Loader2, X } from 'lucide-react';
import { CreditCard as CreditCardType, ExpenseCategory, EXPENSE_CATEGORIES } from '@/lib/types';
import { formatCurrency, getBillingMonthOptions } from '@/lib/calculations';
import { CSVData, MappingFormData, PreviewItem } from './_shared';

// ─── Parsing overlay ─────────────────────────────────────────────────────────

export function CartaoParsingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, margin: '0 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.16)' }}
      >
        <Loader2 size={32} className="animate-spin" color="var(--accent)" />
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', textAlign: 'center', margin: 0 }}>
          Analisando transações com IA...
        </p>
      </div>
    </div>
  );
}

// ─── New card inline form (shared by card picker + mapping modal) ─────────────

interface NewCardInlineProps {
  newCardName: string;
  onNewCardNameChange: (v: string) => void;
  newCardLimit: string;
  onNewCardLimitChange: (v: string) => void;
  newCardClosingDay: string;
  onNewCardClosingDayChange: (v: string) => void;
  newCardDueDay: string;
  onNewCardDueDayChange: (v: string) => void;
  creatingNewCard: boolean;
  onCreateAndLink: () => void;
  onCancel: () => void;
  /**
   * Card picker sheet uses a flat green; mapping modal uses a gradient. Keep this opt-in
   * to preserve visual parity with the original page.
   */
  buttonGradient?: boolean;
}

function NewCardInlineForm({
  newCardName,
  onNewCardNameChange,
  newCardLimit,
  onNewCardLimitChange,
  newCardClosingDay,
  onNewCardClosingDayChange,
  newCardDueDay,
  onNewCardDueDayChange,
  creatingNewCard,
  onCreateAndLink,
  onCancel,
  buttonGradient,
}: NewCardInlineProps) {
  return (
    <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        type="text"
        value={newCardName}
        onChange={(e) => onNewCardNameChange(e.target.value)}
        placeholder="Nome do cartão (ex: XP, Inter, Itaú...)"
        maxLength={40}
        autoFocus
        style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
      />
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={newCardLimit}
        onChange={(e) => onNewCardLimitChange(e.target.value)}
        placeholder="Limite em R$ (opcional)"
        style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={28}
          value={newCardClosingDay}
          onChange={(e) => onNewCardClosingDayChange(e.target.value)}
          placeholder="Fecha dia (opcional)"
          style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
        />
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={28}
          value={newCardDueDay}
          onChange={(e) => onNewCardDueDayChange(e.target.value)}
          placeholder="Vence dia (opcional)"
          style={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
        />
      </div>
      <div className="flex items-center gap-3 pt-0.5">
        <button
          onClick={onCreateAndLink}
          disabled={!newCardName.trim() || creatingNewCard}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5"
          style={{ background: buttonGradient ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--green)' }}
        >
          {creatingNewCard && <Loader2 size={13} className="animate-spin" />}
          Criar e vincular
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2.5"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Card picker sheet (Nubank + stale mapping) ──────────────────────────────

export interface CardPickerSheetProps {
  show: boolean;
  cards: CreditCardType[];
  cardPickerSelectedId: string;
  onCardPickerSelectedIdChange: (id: string) => void;
  showNewCardInline: boolean;
  onShowNewCardInline: (show: boolean) => void;
  newCardName: string;
  onNewCardNameChange: (v: string) => void;
  newCardLimit: string;
  onNewCardLimitChange: (v: string) => void;
  newCardClosingDay: string;
  onNewCardClosingDayChange: (v: string) => void;
  newCardDueDay: string;
  onNewCardDueDayChange: (v: string) => void;
  creatingNewCard: boolean;
  onCreateAndLink: () => void;
  onResetInlineCardForm: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CartaoCardPickerSheet(props: CardPickerSheetProps) {
  if (!props.show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 512, display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Importar fatura</h2>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
            Selecione o cartão para vincular as transações
          </p>
        </div>

        <div className="px-5 py-5">
          <label className="text-gray-700 text-xs font-semibold block mb-1.5">
            Vincular ao cartão
          </label>
          {props.showNewCardInline ? (
            <NewCardInlineForm
              newCardName={props.newCardName}
              onNewCardNameChange={props.onNewCardNameChange}
              newCardLimit={props.newCardLimit}
              onNewCardLimitChange={props.onNewCardLimitChange}
              newCardClosingDay={props.newCardClosingDay}
              onNewCardClosingDayChange={props.onNewCardClosingDayChange}
              newCardDueDay={props.newCardDueDay}
              onNewCardDueDayChange={props.onNewCardDueDayChange}
              creatingNewCard={props.creatingNewCard}
              onCreateAndLink={props.onCreateAndLink}
              onCancel={props.onResetInlineCardForm}
            />
          ) : (
            <select
              value={props.cardPickerSelectedId}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  props.onShowNewCardInline(true);
                } else {
                  props.onCardPickerSelectedIdChange(e.target.value);
                }
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
            >
              <option value="" disabled>Selecionar cartão...</option>
              {props.cards.map((card) => (
                <option key={card.id} value={card.id}>{card.nome}</option>
              ))}
              <option value="__new__">+ Adicionar novo cartão</option>
            </select>
          )}
        </div>

        <div style={{ padding: '0 20px 24px', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={props.onCancel}
            style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={props.onConfirm}
            disabled={!props.cardPickerSelectedId || props.showNewCardInline}
            style={{ flex: 2, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer', opacity: (!props.cardPickerSelectedId || props.showNewCardInline) ? 0.6 : 1 }}
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Raw data preview modal ───────────────────────────────────────────────────

export interface RawPreviewModalProps {
  show: boolean;
  csvRawData: CSVData;
  onWrongFile: () => void;
  onConfirm: () => void;
}

export function CartaoRawPreviewModal({ show, csvRawData, onWrongFile, onConfirm }: RawPreviewModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 512, display: 'flex', flexDirection: 'column', maxHeight: '85vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Verifique os dados do arquivo</h2>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
            {csvRawData.rows.length} linha{csvRawData.rows.length !== 1 ? 's' : ''} encontrada
            {csvRawData.rows.length !== 1 ? 's' : ''} — os dados abaixo estão corretos?
          </p>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  {csvRawData.headers.map((h) => (
                    <th
                      key={h}
                      className="text-left text-gray-500 font-semibold px-2 py-1.5 bg-gray-50 border-b border-gray-100 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRawData.rows.slice(0, 5).map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-50">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-2 py-1.5 text-gray-700 whitespace-nowrap"
                        style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button
            onClick={onWrongFile}
            style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}
          >
            Arquivo errado
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 2, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer' }}
          >
            Está correto, continuar →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mapping modal ────────────────────────────────────────────────────────────

export interface MappingModalProps {
  show: boolean;
  cards: CreditCardType[];
  csvRawData: CSVData;
  mappingForm: MappingFormData;
  onMappingFormChange: (form: MappingFormData) => void;
  mappingColsAreDuplicated: boolean;
  getColExample: (colName: string) => string;
  isMappingValid: boolean;
  showNewCardInline: boolean;
  onShowNewCardInline: (show: boolean) => void;
  newCardName: string;
  onNewCardNameChange: (v: string) => void;
  newCardLimit: string;
  onNewCardLimitChange: (v: string) => void;
  newCardClosingDay: string;
  onNewCardClosingDayChange: (v: string) => void;
  newCardDueDay: string;
  onNewCardDueDayChange: (v: string) => void;
  creatingNewCard: boolean;
  onCreateAndLink: () => void;
  onResetInlineCardForm: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function CartaoMappingModal(props: MappingModalProps) {
  if (!props.show) return null;
  const { mappingForm, csvRawData, onMappingFormChange } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 512, display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Formato não reconhecido</h2>
            <button
              onClick={props.onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-3)' }}
            >
              <X size={20} />
            </button>
          </div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
            Configure uma vez e o app vai lembrar para próximas importações
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Card selection */}
          <div>
            <label className="text-gray-700 text-xs font-semibold block mb-1.5">
              Vincular ao cartão
            </label>
            {props.showNewCardInline ? (
              <NewCardInlineForm
                newCardName={props.newCardName}
                onNewCardNameChange={props.onNewCardNameChange}
                newCardLimit={props.newCardLimit}
                onNewCardLimitChange={props.onNewCardLimitChange}
                newCardClosingDay={props.newCardClosingDay}
                onNewCardClosingDayChange={props.onNewCardClosingDayChange}
                newCardDueDay={props.newCardDueDay}
                onNewCardDueDayChange={props.onNewCardDueDayChange}
                creatingNewCard={props.creatingNewCard}
                onCreateAndLink={props.onCreateAndLink}
                onCancel={props.onResetInlineCardForm}
                buttonGradient
              />
            ) : (
              <select
                value={mappingForm.selectedCardId}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    props.onShowNewCardInline(true);
                  } else {
                    onMappingFormChange({ ...mappingForm, selectedCardId: e.target.value });
                  }
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
              >
                <option value="" disabled>Selecionar cartão...</option>
                {props.cards.map((card) => (
                  <option key={card.id} value={card.id}>{card.nome}</option>
                ))}
                <option value="__new__">+ Adicionar novo cartão</option>
              </select>
            )}
          </div>

          {/* Bank name */}
          <div>
            <label className="text-gray-700 text-xs font-semibold block mb-1.5">
              Nome do banco
            </label>
            <input
              type="text"
              value={mappingForm.bankName}
              onChange={(e) => onMappingFormChange({ ...mappingForm, bankName: e.target.value })}
              placeholder="Ex: Inter, C6, Itaú..."
              maxLength={40}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-green-400 transition-colors"
            />
          </div>

          {/* Detected columns chips */}
          <div>
            <p className="text-gray-700 text-xs font-semibold mb-2">
              Identificamos {csvRawData.headers.length} colunas no seu arquivo:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {csvRawData.headers.map((col) => (
                <span
                  key={col}
                  className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-mono"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Column mapping with examples */}
          <div className="space-y-4">
            <div>
              <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                Coluna da Data
              </label>
              <select
                value={mappingForm.dateColumn}
                onChange={(e) => onMappingFormChange({ ...mappingForm, dateColumn: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
              >
                {csvRawData.headers.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              {mappingForm.dateColumn && props.getColExample(mappingForm.dateColumn) && (
                <p className="text-gray-400 text-xs mt-1 ml-1">
                  ex: {props.getColExample(mappingForm.dateColumn)}
                </p>
              )}
            </div>

            <div>
              <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                Coluna da Descrição
              </label>
              <select
                value={mappingForm.descriptionColumn}
                onChange={(e) =>
                  onMappingFormChange({ ...mappingForm, descriptionColumn: e.target.value })
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
              >
                {csvRawData.headers.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              {mappingForm.descriptionColumn && props.getColExample(mappingForm.descriptionColumn) && (
                <p className="text-gray-400 text-xs mt-1 ml-1">
                  ex: {props.getColExample(mappingForm.descriptionColumn)}
                </p>
              )}
            </div>

            <div>
              <label className="text-gray-700 text-xs font-semibold block mb-1.5">
                Coluna do Valor
              </label>
              <select
                value={mappingForm.amountColumn}
                onChange={(e) =>
                  onMappingFormChange({ ...mappingForm, amountColumn: e.target.value })
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors"
              >
                {csvRawData.headers.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              {mappingForm.amountColumn && props.getColExample(mappingForm.amountColumn) && (
                <p className="text-gray-400 text-xs mt-1 ml-1">
                  ex: {props.getColExample(mappingForm.amountColumn)}
                </p>
              )}
            </div>

            {props.mappingColsAreDuplicated && (
              <p className="text-red-400 text-xs">
                Selecione colunas diferentes para cada campo.
              </p>
            )}
          </div>

          {/* Negative toggle */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-700 text-sm font-medium">
                Os gastos vêm como valores negativos?
              </span>
              <button
                type="button"
                onClick={() =>
                  onMappingFormChange({ ...mappingForm, negativeIsExpense: !mappingForm.negativeIsExpense })
                }
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  mappingForm.negativeIsExpense ? 'bg-green-500' : 'bg-gray-300'
                }`}
                aria-checked={mappingForm.negativeIsExpense}
                role="switch"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    mappingForm.negativeIsExpense ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-gray-400 text-xs">
              {mappingForm.negativeIsExpense
                ? 'Valores negativos (ex: -50,00) serão tratados como gastos'
                : 'Valores positivos (ex: 50,00) serão tratados como gastos'}
            </p>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button
            onClick={props.onClose}
            style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={props.onConfirm}
            disabled={!props.isMappingValid}
            style={{ flex: 2, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: !props.isMappingValid ? 0.6 : 1 }}
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview import modal ─────────────────────────────────────────────────────

export interface PreviewImportModalProps {
  show: boolean;
  importFlow: 'idle' | 'parsing' | 'preview' | 'inserting';
  currentBankName: string;
  previewItems: PreviewItem[];
  nonDupsWithIdx: Array<{ item: PreviewItem; i: number }>;
  dupCount: number;
  skippedCount: number;
  importBillingMonth: string;
  onImportBillingMonthChange: (m: string) => void;
  onUpdatePreviewCategory: (index: number, category: ExpenseCategory) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CartaoPreviewImportModal({
  show,
  importFlow,
  currentBankName,
  nonDupsWithIdx,
  dupCount,
  skippedCount,
  importBillingMonth,
  onImportBillingMonthChange,
  onUpdatePreviewCategory,
  onCancel,
  onConfirm,
}: PreviewImportModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 512, display: 'flex', flexDirection: 'column', maxHeight: '85vh', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
      >
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Importar fatura {currentBankName}
          </h2>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
            {nonDupsWithIdx.length} transaç
            {nonDupsWithIdx.length !== 1 ? 'ões' : 'ão'} encontrada
            {nonDupsWithIdx.length !== 1 ? 's' : ''}
          </p>

          {/* Billing month selector */}
          <div className="mt-3">
            <label className="text-gray-500 text-xs font-medium block mb-1.5">
              Mês de referência da fatura
            </label>
            <select
              value={importBillingMonth}
              onChange={(e) => onImportBillingMonthChange(e.target.value)}
              disabled={importFlow === 'inserting'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-green-400 transition-colors disabled:opacity-60"
            >
              {getBillingMonthOptions().map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {nonDupsWithIdx.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-500 text-sm">Todas as transações já existem.</p>
            </div>
          ) : (
            nonDupsWithIdx.map(({ item, i }) => (
              <div key={i} className="px-4 py-3 flex items-center gap-2">
                <span className="text-xs text-gray-400 w-10 flex-shrink-0 font-mono tabular-nums">
                  {item.date.slice(8)}/{item.date.slice(5, 7)}
                </span>
                <span className="flex-1 text-sm text-gray-900 truncate min-w-0">
                  {item.description.charAt(0).toUpperCase() + item.description.slice(1)}
                </span>
                <select
                  value={item.selectedCategory}
                  onChange={(e) =>
                    onUpdatePreviewCategory(i, e.target.value as ExpenseCategory)
                  }
                  disabled={importFlow === 'inserting'}
                  className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-gray-700 bg-white flex-shrink-0 max-w-[108px] disabled:opacity-60"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <span className="text-red-500 font-semibold text-xs whitespace-nowrap flex-shrink-0">
                  −{formatCurrency(item.amount)}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {dupCount > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, textAlign: 'center' }}>
              {dupCount} item{dupCount !== 1 ? 's' : ''} ignorado
              {dupCount !== 1 ? 's' : ''} (já existem)
            </p>
          )}
          {skippedCount > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, textAlign: 'center' }}>
              {skippedCount} linha{skippedCount !== 1 ? 's' : ''} ignorada
              {skippedCount !== 1 ? 's' : ''} (valor inválido, data inválida ou descrição vazia)
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onCancel}
              disabled={importFlow === 'inserting'}
              style={{ flex: 1, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', opacity: importFlow === 'inserting' ? 0.5 : 1 }}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={importFlow === 'inserting' || nonDupsWithIdx.length === 0}
              style={{ flex: 2, padding: '13px 0', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--green)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (importFlow === 'inserting' || nonDupsWithIdx.length === 0) ? 0.6 : 1 }}
            >
              {importFlow === 'inserting' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Importando...
                </>
              ) : (
                'Confirmar importação'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
