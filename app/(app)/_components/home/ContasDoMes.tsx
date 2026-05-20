'use client';

import type { Ref } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import LoadingButton from '@/components/ui/LoadingButton';
import { formatCurrency } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import type {
  Category,
  CreditCard as CreditCardType,
  MonthlyObligation,
  RecurringExpense,
} from '@/lib/types';
import { anim, hidden } from './_anim';

type Props = {
  obligations: MonthlyObligation[];
  pendingObligations: MonthlyObligation[];
  activeIncomeRecs: RecurringExpense[];
  recurringExpenses: RecurringExpense[];
  creditCards: CreditCardType[];
  receivedIncomeRecIds: Set<string>;
  todayDay: number;
  payingIds: Set<string>;
  receivingIds: Set<string>;
  highlighting: boolean;
  mounted: boolean;
  sectionRef: Ref<HTMLDivElement>;
  onConfirmIncome: (rec: RecurringExpense) => void;
  onMarkObligationPaid: (obligationId: string) => void;
  onOpenVariablePay: (obligationId: string, estimatedAmount: number) => void;
};

export default function ContasDoMes({
  obligations,
  pendingObligations,
  activeIncomeRecs,
  recurringExpenses,
  creditCards,
  receivedIncomeRecIds,
  todayDay,
  payingIds,
  receivingIds,
  highlighting,
  mounted,
  sectionRef,
  onConfirmIncome,
  onMarkObligationPaid,
  onOpenVariablePay,
}: Props) {
  // Item só conta como "pendente" para Contas do mês quando o day_of_month
  // do recorrente já chegou (ou está em branco — nesse caso considera-se
  // pendente desde o início do mês).
  const isDayReachedForRec = (dom: number | undefined): boolean =>
    dom == null || dom <= todayDay;

  type RowItem =
    | { kind: 'obligation'; ob: MonthlyObligation }
    | { kind: 'income'; rec: RecurringExpense; received: boolean };

  const sortByDay = (a: RecurringExpense, b: RecurringExpense) =>
    (a.dayOfMonth ?? 99) - (b.dayOfMonth ?? 99);
  const sortObByDue = (a: MonthlyObligation, b: MonthlyObligation) =>
    (a.dueDay ?? 99) - (b.dueDay ?? 99);

  const pendingObligationsRows = pendingObligations.slice().sort(sortObByDue);

  const pendingIncomeRows = activeIncomeRecs
    .filter((r) => !receivedIncomeRecIds.has(r.id))
    .filter((r) => isDayReachedForRec(r.dayOfMonth))
    .sort(sortByDay);

  const rows: RowItem[] = [
    ...pendingIncomeRows.map((r): RowItem => ({ kind: 'income', rec: r, received: false })),
    ...pendingObligationsRows.map((o): RowItem => ({ kind: 'obligation', ob: o })),
    ...activeIncomeRecs
      .filter((r) => receivedIncomeRecIds.has(r.id))
      .sort(sortByDay)
      .map((r): RowItem => ({ kind: 'income', rec: r, received: true })),
    ...obligations
      .filter((o) => o.status === 'paid')
      .sort(sortObByDue)
      .map((o): RowItem => ({ kind: 'obligation', ob: o })),
  ];
  const visible = rows.slice(0, 3);

  return (
    <div
      ref={sectionRef}
      style={{ margin: '16px 16px 0', ...(mounted ? anim(350) : hidden) }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Contas do mês
        </p>
        {/* Badge conta apenas despesas fixas pendentes — receitas como
            Salário aparecem na lista, mas nunca no count de pendentes. */}
        {pendingObligations.length > 0 && (
          <span
            style={{
              background: 'var(--yellow-bg)',
              color: 'var(--yellow-text)',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 20,
            }}
          >
            {pendingObligations.length} pendente
            {pendingObligations.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Card list */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          overflow: 'hidden',
        }}
      >
        <div>
          {visible.map((item, idx) => {
            const isLast = idx === visible.length - 1 && rows.length <= 3;
            const borderStyle = isLast
              ? {}
              : { borderBottom: '1px solid var(--border-2)' };

            if (item.kind === 'income') {
              const { rec, received } = item;
              const cfg = CATEGORY_CONFIG[rec.category as Category];
              const isReceiving = receivingIds.has(rec.id);
              return (
                <div
                  key={`income-${rec.id}`}
                  style={{
                    padding: '13px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    opacity: received ? 0.45 : 1,
                    transition: 'opacity 0.2s',
                    ...borderStyle,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'var(--logo-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {cfg?.icon ?? '💰'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text)',
                        margin: 0,
                        textDecoration: received ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rec.description
                        ? rec.description.charAt(0).toUpperCase() +
                          rec.description.slice(1)
                        : ''}
                    </p>
                    {!received && (
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--text-3)',
                          marginTop: 2,
                        }}
                      >
                        {typeof rec.dayOfMonth === 'number' &&
                        rec.dayOfMonth >= 1 &&
                        rec.dayOfMonth <= 31
                          ? `Recebimento dia ${rec.dayOfMonth}`
                          : 'Recebimento mensal'}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: received ? 'var(--text-3)' : 'var(--green)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      textDecoration: received ? 'line-through' : 'none',
                    }}
                  >
                    +{formatCurrency(rec.amount)}
                  </span>
                  {received ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--green)',
                        flexShrink: 0,
                      }}
                    >
                      Pago ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => onConfirmIncome(rec)}
                      disabled={isReceiving}
                      style={{
                        width: 27,
                        height: 27,
                        borderRadius: '50%',
                        background: 'var(--green-bg)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        opacity: isReceiving ? 0.5 : 1,
                      }}
                      title="Confirmar recebimento"
                    >
                      {isReceiving ? (
                        <Loader2 size={13} color="var(--green)" className="animate-spin" />
                      ) : (
                        <Check size={13} color="var(--green)" />
                      )}
                    </button>
                  )}
                </div>
              );
            }

            const { ob } = item;
            const cfg = CATEGORY_CONFIG[ob.category as Category];
            const isPaid = ob.status === 'paid';
            const isPaying = payingIds.has(ob.id);
            const hasDueDay =
              typeof ob.dueDay === 'number' && ob.dueDay >= 1 && ob.dueDay <= 31;
            const daysLate =
              !isPaid && hasDueDay && todayDay > ob.dueDay!
                ? todayDay - ob.dueDay!
                : 0;
            const dueToday = !isPaid && hasDueDay && todayDay === ob.dueDay;
            const dueTomorrow = !isPaid && hasDueDay && ob.dueDay === todayDay + 1;
            const dueLabelText = isPaid
              ? ''
              : !hasDueDay
              ? '' // sem prazo definido — não mostra "Vence dia X"
              : daysLate > 0
              ? `Venceu há ${daysLate} dia${daysLate > 1 ? 's' : ''}`
              : dueToday
              ? 'Vence hoje'
              : dueTomorrow
              ? 'Vence amanhã'
              : `Vence dia ${ob.dueDay}`;
            const dueLabelColor =
              daysLate > 0
                ? 'var(--red)'
                : dueToday
                ? 'var(--yellow-text)'
                : 'var(--text-3)';
            const obRec = recurringExpenses.find(
              (r) => r.id === ob.recurringExpenseId
            );
            const obCardName =
              obRec?.isCredit && obRec.creditCardId
                ? creditCards.find((c) => c.id === obRec.creditCardId)?.nome
                : undefined;

            return (
              <div
                key={ob.id}
                style={{
                  padding: '13px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: isPaid ? 0.45 : 1,
                  transition: 'opacity 0.2s',
                  ...(highlighting && !isPaid
                    ? {
                        background: 'rgba(255,184,0,0.06)',
                      }
                    : {}),
                  ...borderStyle,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--logo-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {cfg?.icon ?? '💸'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text)',
                      margin: 0,
                      textDecoration: isPaid ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ob.description
                      ? ob.description.charAt(0).toUpperCase() +
                        ob.description.slice(1)
                      : ''}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                      marginTop: 2,
                    }}
                  >
                    {!isPaid && (
                      <p
                        style={{
                          fontSize: 11,
                          color: dueLabelColor,
                          margin: 0,
                        }}
                      >
                        {dueLabelText}
                      </p>
                    )}
                    {obCardName && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--accent-bg)',
                          color: 'var(--accent)',
                        }}
                      >
                        {obCardName}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: isPaid ? 'var(--text-3)' : 'var(--text)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    textDecoration: isPaid ? 'line-through' : 'none',
                  }}
                >
                  {formatCurrency(ob.amount)}
                </span>
                {isPaid ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--green)',
                      flexShrink: 0,
                    }}
                  >
                    Pago ✓
                  </span>
                ) : (
                  <LoadingButton
                    onClick={() => {
                      const rec = recurringExpenses.find(
                        (r) => r.id === ob.recurringExpenseId
                      );
                      if (rec?.isVariable) {
                        onOpenVariablePay(ob.id, ob.amount);
                      } else {
                        onMarkObligationPaid(ob.id);
                      }
                    }}
                    loading={isPaying}
                    spinnerSize={13}
                    spinnerColor="var(--accent)"
                    style={{
                      width: 27,
                      height: 27,
                      borderRadius: '50%',
                      background: 'var(--accent-bg)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      opacity: isPaying ? 0.5 : 1,
                    }}
                    title="Marcar como pago"
                  >
                    <Check size={13} color="var(--accent)" />
                  </LoadingButton>
                )}
              </div>
            );
          })}
        </div>

        {rows.length > 3 && (
          <Link
            href="/recorrentes"
            style={{
              display: 'block',
              padding: '12px 16px',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              borderTop: '1px solid var(--border-2)',
            }}
          >
            Ver todas as {rows.length} contas →
          </Link>
        )}
      </div>
    </div>
  );
}
