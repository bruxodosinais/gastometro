'use client';

import { Loader2, MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import LoadingButton from '@/components/ui/LoadingButton';
import { formatCurrency } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import type {
  CreditCard as CreditCardType,
  Expense,
  MonthlyObligation,
  RecurringExpense,
} from '@/lib/types';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { menuItemStyle } from './_shared';

export type RecorrenteCardSharedProps = {
  expenses: Expense[];
  obligations: MonthlyObligation[];
  creditCards: CreditCardType[];
  selectedMonth: string;
  isCurrentMonth: boolean;
  isPastMonth: boolean;
  todayDay: number;
  payingIds: Set<string>;
  undoingIds: Set<string>;
  receivingIds: Set<string>;
  unreceivingIds: Set<string>;
  paidExpenseIds: Map<string, string>;
  openMenuId: string | null;
  onToggleMenu: (id: string | null) => void;
  onMarkPaidClick: (rec: RecurringExpense) => void;
  onUnmarkObligationPaid: (obligationId: string) => void;
  onMarkIncomeReceived: (rec: RecurringExpense) => void;
  onUnmarkIncomeReceived: (rec: RecurringExpense) => void;
  onEdit: (rec: RecurringExpense) => void;
  onToggleActive: (rec: RecurringExpense) => void;
  onDelete: (id: string) => void;
};

type Props = RecorrenteCardSharedProps & {
  rec: RecurringExpense;
};

export default function RecorrenteCard({
  rec,
  expenses,
  obligations,
  creditCards,
  selectedMonth,
  isCurrentMonth,
  isPastMonth,
  todayDay,
  payingIds,
  undoingIds,
  receivingIds,
  unreceivingIds,
  paidExpenseIds,
  openMenuId,
  onToggleMenu,
  onMarkPaidClick,
  onUnmarkObligationPaid,
  onMarkIncomeReceived,
  onUnmarkIncomeReceived,
  onEdit,
  onToggleActive,
  onDelete,
}: Props) {
  const { categories: customs } = useCustomCategories();
  const cfg = getCategoryDisplay(rec.category, customs);
  const isIncome = rec.type === 'income';
  const obligation = obligations.find((o) => o.recurringExpenseId === rec.id);
  const isPaid = obligation?.status === 'paid';
  const isPaying = obligation ? payingIds.has(obligation.id) : false;
  // BUG 2: para receitas, o "recebido" é provado pelo lançamento income
  // linkado ao recorrente no mês visualizado (não há obligation).
  const incomeReceivedEntry = isIncome
    ? expenses.find(
        (e) =>
          e.recurringExpenseId === rec.id &&
          typeof e.date === 'string' &&
          e.date.slice(0, 7) === selectedMonth
      )
    : undefined;
  const isReceived = !!incomeReceivedEntry;
  // Atraso/vencimento: usa EXCLUSIVAMENTE rec.dueDay. Não faz fallback para
  // dayOfMonth — esses são campos com semânticas distintas (dia de lançamento
  // vs. prazo para pagar sem atraso). Sem dueDay válido → sem badge de atraso.
  const effectiveDueDay: number | undefined =
    typeof rec.dueDay === 'number' && rec.dueDay >= 1 && rec.dueDay <= 31
      ? rec.dueDay
      : undefined;
  const hasValidDueDay = effectiveDueDay !== undefined;
  const isMenuOpen = openMenuId === rec.id;

  // Parcelamento (total_installments definido): conta lançamentos já feitos.
  // Usa o array de expenses já carregado — sem query extra.
  const hasInstallments =
    typeof rec.totalInstallments === 'number' && rec.totalInstallments >= 1;
  const launchedCount = hasInstallments
    ? expenses.filter((e) => e.recurringExpenseId === rec.id).length
    : 0;
  const installmentsTotal = hasInstallments ? (rec.totalInstallments as number) : 0;
  const installmentsProgress = hasInstallments
    ? Math.min(launchedCount / installmentsTotal, 1)
    : 0;

  let leftBorderColor = 'transparent';
  let cardBg = 'var(--surface)';
  let badgeText = '';
  let badgeBg = 'var(--border-2)';
  let badgeColor = 'var(--text-3)';
  let showMarkPaid = false;
  let showUndo = false;
  let showMarkReceived = false;
  let showUndoReceived = false;

  if (isCurrentMonth) {
    const daysLate =
      !isPaid && hasValidDueDay && todayDay > effectiveDueDay!
        ? todayDay - effectiveDueDay!
        : 0;
    const hasObligation = rec.type === 'expense' && rec.active && !!obligation;

    leftBorderColor = !hasObligation ? 'transparent'
      : isPaid ? 'var(--green)'
      : daysLate > 0 ? 'var(--red)'
      : 'var(--yellow)';

    cardBg = !hasObligation ? 'var(--surface)'
      : isPaid ? 'var(--green-bg)'
      : daysLate > 0 ? 'var(--red-bg)'
      : 'var(--yellow-bg)';

    if (hasObligation) {
      const paidAtLabel = (() => {
        if (!obligation?.paidAt) return 'Pago';
        const d = new Date(obligation.paidAt);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `Pago · ${dd}/${mm}`;
      })();
      if (isPaid) {
        badgeText = paidAtLabel;
        badgeBg = 'var(--green)';
        badgeColor = 'white';
      } else if (!hasValidDueDay) {
        // Sem dia de vencimento/lançamento definido — não exibe badge "Atrasado/Vence"
        badgeText = '';
      } else if (daysLate > 0) {
        badgeText = `Atrasado ${daysLate}d`;
        badgeBg = 'var(--red)';
        badgeColor = 'white';
      } else if (todayDay === effectiveDueDay) {
        badgeText = 'Vence hoje';
        badgeBg = 'rgba(255,184,0,0.2)';
        badgeColor = 'var(--yellow-text)';
      } else if (effectiveDueDay === todayDay + 1) {
        badgeText = 'Vence amanhã';
        badgeBg = 'rgba(255,184,0,0.15)';
        badgeColor = 'var(--yellow-text)';
      } else {
        badgeText = `Vence dia ${effectiveDueDay}`;
        badgeBg = 'var(--border-2)';
        badgeColor = 'var(--text-3)';
      }
      showUndo = isPaid && paidExpenseIds.has(obligation!.id);
    }
    // Botão "Marcar pago" aparece SEMPRE que: mês atual + despesa ativa + não
    // paga — independente de ter obligation criada e de ter due_day. Quando
    // falta obligation o handler cria uma sob demanda antes de marcar paga.
    const paidThisMonth = expenses.some(
      (e) =>
        e.recurringExpenseId === rec.id &&
        typeof e.date === 'string' &&
        e.date.slice(0, 7) === selectedMonth
    );
    showMarkPaid =
      rec.type === 'expense' && rec.active && !isPaid && !paidThisMonth;
  } else if (isPastMonth) {
    if (rec.type === 'expense' && rec.active) {
      const paidAtLabel = (() => {
        if (!obligation?.paidAt) return 'Pago';
        const d = new Date(obligation.paidAt);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `Pago · ${dd}/${mm}`;
      })();
      if (isPaid) {
        badgeText = paidAtLabel;
        badgeBg = 'var(--green)'; badgeColor = 'white';
        leftBorderColor = 'var(--green)'; cardBg = 'var(--green-bg)';
      } else {
        badgeText = 'Não pago';
        badgeBg = 'var(--red-bg)'; badgeColor = 'var(--red)';
        leftBorderColor = 'rgba(255,71,87,0.4)'; cardBg = 'var(--red-bg)';
      }
    }
  } else {
    if (rec.type === 'expense' && rec.active) {
      badgeText = 'Previsto';
      badgeBg = 'var(--border-2)'; badgeColor = 'var(--text-3)';
    }
  }

  // BUG 2: tratamento das RECEITAS fixas — espelha o comportamento das
  // despesas ("Marcar pago"/"Desfazer"/badges), mas baseado no lançamento
  // income linkado (incomeReceivedEntry) e não na tabela de obrigações.
  if (isIncome && rec.active) {
    if (isReceived && incomeReceivedEntry) {
      const [, mm, dd] = incomeReceivedEntry.date.split('-');
      badgeText = `Recebido · ${dd}/${mm}`;
      badgeBg = 'var(--green)';
      badgeColor = 'white';
      leftBorderColor = 'var(--green)';
      cardBg = 'var(--green-bg)';
      // Desfazer só no mês atual (idêntico ao "Desfazer" das despesas).
      showUndoReceived = isCurrentMonth;
    } else if (isCurrentMonth) {
      badgeText = 'A receber';
      badgeBg = 'var(--border-2)';
      badgeColor = 'var(--text-3)';
      showMarkReceived = true;
    } else if (isPastMonth) {
      badgeText = 'Não recebido';
      badgeBg = 'var(--red-bg)';
      badgeColor = 'var(--red)';
      leftBorderColor = 'rgba(255,71,87,0.4)';
      cardBg = 'var(--red-bg)';
    } else {
      badgeText = 'Previsto';
      badgeBg = 'var(--border-2)';
      badgeColor = 'var(--text-3)';
    }
  }

  const contentOpacity =
    isCurrentMonth && (isPaid || (isIncome && isReceived)) ? 0.55 : 1;
  const displayName = rec.description?.trim()
    ? rec.description.charAt(0).toUpperCase() + rec.description.slice(1)
    : rec.category || 'Sem descrição';
  const cardName = rec.isCredit && rec.creditCardId
    ? creditCards.find((c) => c.id === rec.creditCardId)?.nome
    : null;

  return (
    <div
      style={{
        background: cardBg,
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        borderLeftWidth: 3,
        borderLeftColor: leftBorderColor,
        padding: '12px 14px',
        boxShadow: 'var(--card-shadow)',
        opacity: rec.active ? 1 : 0.45,
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Category icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--logo-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
            opacity: contentOpacity,
          }}
        >
          {cfg.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: name + badge variável + valor + menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <p
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text)',
                lineHeight: 1.25,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: contentOpacity,
              }}
            >
              {displayName}
            </p>
            {rec.isVariable && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                ~variável
              </span>
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: isIncome ? 'var(--green)' : 'var(--red)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                opacity: contentOpacity,
              }}
            >
              {isIncome ? '+' : ''}{rec.isVariable ? '~' : ''}{formatCurrency(rec.amount)}
            </span>

            {/* Menu */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu(isMenuOpen ? null : rec.id);
                }}
                style={{
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                aria-label="Mais opções"
              >
                <MoreHorizontal size={14} />
              </button>
              {isMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 30,
                    zIndex: 20,
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    overflow: 'hidden',
                    minWidth: 120,
                  }}
                >
                  <button onClick={() => { onEdit(rec); onToggleMenu(null); }} style={menuItemStyle}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => { onToggleActive(rec); onToggleMenu(null); }} style={menuItemStyle}>
                    {rec.active ? <Pause size={12} /> : <Play size={12} />}
                    {rec.active ? 'Pausar' : 'Ativar'}
                  </button>
                  <button onClick={() => { onDelete(rec.id); onToggleMenu(null); }} style={{ ...menuItemStyle, color: 'var(--red)' }}>
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: meta + cartão + badge + ações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rec.category}
            </span>
            {typeof rec.dayOfMonth === 'number' && rec.dayOfMonth >= 1 && rec.dayOfMonth <= 31 ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
                · Todo dia {rec.dayOfMonth}
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', fontStyle: 'italic' }}>
                · Dia não definido
              </span>
            )}
            {cardName && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                {cardName}
              </span>
            )}
            {/* Classificação: Fixa (despesa sem prazo) vs Dívida (com prazo).
                Receitas não recebem badge — só despesas. */}
            {rec.type === 'expense' && !hasInstallments && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'var(--border-2)',
                  color: 'var(--text-3)',
                  flexShrink: 0,
                }}
              >
                Fixa
              </span>
            )}
            {hasInstallments && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(255,184,0,0.15)',
                  color: 'var(--yellow-text)',
                  flexShrink: 0,
                }}
              >
                Dívida
              </span>
            )}
            {hasInstallments && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  flexShrink: 0,
                }}
                aria-label={`${launchedCount} de ${installmentsTotal} parcelas`}
              >
                {launchedCount}/{installmentsTotal} parcelas
              </span>
            )}
            {badgeText && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: badgeBg,
                  color: badgeColor,
                  flexShrink: 0,
                }}
              >
                {badgeText}
              </span>
            )}
            {showMarkPaid && (
              <LoadingButton
                onClick={() => onMarkPaidClick(rec)}
                loading={isPaying}
                spinnerSize={12}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 16px',
                  borderRadius: 8,
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'Nunito, sans-serif',
                  whiteSpace: 'nowrap',
                  cursor: isPaying ? 'not-allowed' : 'pointer',
                  opacity: isPaying ? 0.6 : 1,
                  boxShadow: '0 1px 3px rgba(91,91,214,0.25)',
                }}
              >
                Marcar pago
              </LoadingButton>
            )}
            {showUndo && obligation && (
              <button
                onClick={() => onUnmarkObligationPaid(obligation.id)}
                disabled={undoingIds.has(obligation.id)}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 6,
                  background: 'var(--bg)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: undoingIds.has(obligation.id) ? 'not-allowed' : 'pointer',
                  opacity: undoingIds.has(obligation.id) ? 0.6 : 1,
                }}
              >
                {undoingIds.has(obligation.id) ? <Loader2 size={10} className="animate-spin" /> : 'Desfazer'}
              </button>
            )}
            {showMarkReceived && (
              <LoadingButton
                onClick={() => onMarkIncomeReceived(rec)}
                loading={receivingIds.has(rec.id)}
                spinnerSize={12}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 16px',
                  borderRadius: 8,
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'Nunito, sans-serif',
                  whiteSpace: 'nowrap',
                  cursor: receivingIds.has(rec.id) ? 'not-allowed' : 'pointer',
                  opacity: receivingIds.has(rec.id) ? 0.6 : 1,
                  boxShadow: '0 1px 3px rgba(91,91,214,0.25)',
                }}
              >
                Marcar recebido
              </LoadingButton>
            )}
            {showUndoReceived && (
              <button
                onClick={() => onUnmarkIncomeReceived(rec)}
                disabled={unreceivingIds.has(rec.id)}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 6,
                  background: 'var(--bg)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: unreceivingIds.has(rec.id) ? 'not-allowed' : 'pointer',
                  opacity: unreceivingIds.has(rec.id) ? 0.6 : 1,
                }}
              >
                {unreceivingIds.has(rec.id) ? <Loader2 size={10} className="animate-spin" /> : 'Desfazer'}
              </button>
            )}
          </div>

          {/* Row 3: status de vencimento (abaixo da categoria) */}
          {isCurrentMonth && rec.type === 'expense' && rec.active && !isPaid && (() => {
            if (!hasValidDueDay) {
              return (
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-3)',
                    fontStyle: 'italic',
                    margin: '4px 0 0',
                  }}
                >
                  · Vencimento não definido
                </p>
              );
            }
            const diff = effectiveDueDay! - todayDay;
            if (diff < 0) {
              const n = -diff;
              return (
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', margin: '4px 0 0' }}>
                  Venceu há {n} dia{n > 1 ? 's' : ''}
                </p>
              );
            }
            if (diff === 0) {
              return (
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow-text)', margin: '4px 0 0' }}>
                  Vence hoje
                </p>
              );
            }
            return (
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow-text)', margin: '4px 0 0' }}>
                Vence em {diff} dia{diff > 1 ? 's' : ''}
              </p>
            );
          })()}
        </div>
      </div>

      {hasInstallments && (
        <div
          style={{
            marginTop: 10,
            height: 3,
            width: '100%',
            background: 'var(--border-2)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={installmentsTotal}
          aria-valuenow={launchedCount}
          aria-label={`Progresso de parcelas: ${launchedCount} de ${installmentsTotal}`}
        >
          <div
            style={{
              height: '100%',
              width: `${installmentsProgress * 100}%`,
              background: 'var(--accent)',
              borderRadius: 999,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  );
}
