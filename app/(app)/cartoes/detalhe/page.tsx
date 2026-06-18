'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  addExpense,
  getCreditCards,
  getCreditCardFatura,
  getCreditCardPayment,
  getExpensesByCard,
} from '@/lib/storage';
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { CreditCard as CreditCardType, Expense } from '@/lib/types';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { ToastContainer, useToast } from '@/components/Toast';
import LoadingButton from '@/components/ui/LoadingButton';
import { getErrorMessage } from '@/lib/errors';

function todayPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// "YYYY-MM-DD" → "DD/MM/YYYY" (sem new Date, evita shift de timezone).
function formatDateBR(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

// Detalhe do cartão via query-param (/cartoes/detalhe?id=). Substitui a rota
// dinâmica /cartoes/[id] (incompatível com output:'export' por ser client sem
// generateStaticParams). useSearchParams exige Suspense p/ prerender estático.
function CartaoDetalheInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardId = searchParams.get('id') ?? '';
  const { categories: customs } = useCustomCategories();

  const [card, setCard] = useState<CreditCardType | null>(null);
  const [period, setPeriod] = useState(todayPeriod());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fatura, setFatura] = useState(0);
  const [payment, setPayment] = useState<{ total: number; lastDate: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    if (!cardId) { router.replace('/cartoes'); return; }
    getCreditCards().then((cards) => {
      const found = cards.find((c) => c.id === cardId);
      if (!found) { router.replace('/cartoes'); return; }
      setCard(found);
    });
  }, [cardId, router]);

  useEffect(() => {
    if (!card) return;
    setReady(false);
    Promise.all([
      getExpensesByCard(cardId, period),
      getCreditCardFatura(cardId, period),
      getCreditCardPayment(cardId, period),
    ]).then(([exps, total, pay]) => {
      setExpenses(exps);
      setFatura(total);
      setPayment(pay);
      setReady(true);
      setPaySuccess(false);
    });
  }, [card, cardId, period]);

  async function handlePayFatura() {
    // Edge cases: sem cartão carregado, fatura zerada/sem lançamentos,
    // pagamento em andamento ou já concluído neste período.
    if (!card || fatura <= 0 || paying || paySuccess) return;
    setPaying(true);
    try {
      // period é "YYYY-MM" → descrição "Pagamento fatura NOME MM/YYYY".
      const ref = `${period.slice(5, 7)}/${period.slice(0, 4)}`;
      await addExpense({
        type: 'expense',
        amount: fatura,
        description: `Pagamento fatura ${card.nome} ${ref}`,
        category: 'Cartão de Crédito',
        date: todayStr(),
        // Pagamento é uma saída de caixa (débito), NÃO um lançamento da
        // própria fatura — isCredit false evita recursão no total da fatura.
        // creditCardId + billingMonth amarram o pagamento à fatura paga, para
        // getCreditCardFatura abatê-lo do total (Home, lista e detalhe).
        isCredit: false,
        creditCardId: card.id,
        billingMonth: `${period}-01`,
      });
      setPaySuccess(true);
      addToast('Fatura paga! Lançamento registrado.', 'success');
      // Reflete o novo saldo da fatura nesta tela (número + barra) e o
      // estado "Fatura paga" (badge + data + valor).
      Promise.all([
        getCreditCardFatura(cardId, period),
        getCreditCardPayment(cardId, period),
      ])
        .then(([total, pay]) => {
          setFatura(total);
          setPayment(pay);
        })
        .catch(() => {});
      // router.refresh() removido: a Home é client-side (busca via storage),
      // logo refresh de RSC não atualizava nada lá. addExpense já invalidou a
      // cache de 'expenses' — a Home pega o dado novo na próxima navegação.
    } catch (err) {
      // addExpense pode lançar um PostgrestError (objeto puro, não Error) —
      // getErrorMessage normaliza para uma mensagem legível em vez de
      // "[object Object]". Mantém o botão habilitado para nova tentativa.
      addToast(getErrorMessage(err), 'error');
    } finally {
      setPaying(false);
    }
  }

  const fatPct = card && card.limite > 0 ? Math.min((fatura / card.limite) * 100, 100) : 0;
  const isCurrentPeriod = period === todayPeriod();
  // Fatura quitada: saldo zerado E há pagamento registrado no período.
  // fatura === 0 sem pagamento (mês sem compras) NÃO entra neste estado.
  const isPaid = fatura === 0 && payment !== null;

  const grouped = expenses.reduce<Record<string, Expense[]>>((acc, exp) => {
    if (!acc[exp.date]) acc[exp.date] = [];
    acc[exp.date].push(exp);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  // Soma bruta dos lançamentos listados (compras no crédito). Difere de
  // `fatura` quando há pagamento: `fatura` é o saldo em aberto (líquido),
  // este Total é o que a lista de fato exibe.
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <main className="max-w-lg md:max-w-[600px] mx-auto px-4 pt-8 pb-28">
      <button
        onClick={() => router.push('/cartoes')}
        className="flex items-center gap-1.5 text-[var(--text-2)] hover:text-[var(--text)] text-sm mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        Cartões
      </button>

      {!card ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--text-3)]" />
        </div>
      ) : (
        <>
          {/* Card header */}
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-4"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">💳</span>
              </div>
              <div>
                <h1 className="text-[var(--text)] font-bold text-lg leading-tight">{card.nome}</h1>
                <p className="text-[var(--text-2)] text-sm">Limite {formatCurrency(card.limite)}</p>
              </div>
            </div>

            {(card.diaFechamento || card.diaVencimento) && (
              <div className="flex gap-4 text-xs text-[var(--text-2)] mb-4">
                {card.diaFechamento && <span>Fecha dia {card.diaFechamento}</span>}
                {card.diaVencimento && <span>Vence dia {card.diaVencimento}</span>}
              </div>
            )}

            {/* Period selector */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-2)] hover:bg-[var(--bg)] transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-[var(--text-2)]">
                {getMonthLabel(period)}
              </span>
              <button
                onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
                disabled={isCurrentPeriod}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-2)] hover:bg-[var(--bg)] transition-colors disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Fatura total + progress */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[var(--text-2)]">
                Fatura {period.slice(5, 7)}/{period.slice(0, 4)}
              </span>
              {isPaid ? (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
                >
                  ✓ Fatura paga
                </span>
              ) : (
                <span
                  className="text-base font-bold"
                  style={{ color: fatura > 0 ? '#f04e5e' : 'var(--text-3)' }}
                >
                  {formatCurrency(fatura)}
                </span>
              )}
            </div>
            <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fatPct}%`,
                  background: fatPct >= 90 ? '#ef4444' : fatPct >= 70 ? '#f97316' : '#3b82f6',
                }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-3)] text-right mb-4">
              {Math.round(fatPct)}% do limite utilizado
            </p>

            {/* Pay button (fatura em aberto) */}
            {fatura > 0 && (
              <LoadingButton
                onClick={handlePayFatura}
                loading={paying}
                disabled={paySuccess}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                style={{ background: paySuccess ? '#10b981' : 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                {paySuccess ? '✓ Fatura paga!' : `Pagar fatura · ${formatCurrency(fatura)}`}
              </LoadingButton>
            )}

            {/* Fatura quitada: data + valor pago */}
            {isPaid && payment && (
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: 'var(--green-bg)', border: '1px solid rgba(0,195,122,0.18)' }}
              >
                <span className="text-xs text-[var(--text-2)]">
                  Pago em {formatDateBR(payment.lastDate)}
                </span>
                <span className="text-sm font-bold" style={{ color: 'var(--green-text)' }}>
                  {formatCurrency(payment.total)}
                </span>
              </div>
            )}
          </div>

          {/* Expense list */}
          <h2 className="text-[var(--text)] font-semibold text-sm mb-3">
            Lançamentos na fatura
          </h2>

          {!ready ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[var(--text-3)]" />
            </div>
          ) : expenses.length === 0 ? (
            <div
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl py-10 text-center"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <p className="text-3xl mb-2">📭</p>
              <p className="text-[var(--text-2)] text-sm">Nenhum lançamento neste período</p>
            </div>
          ) : (
            <div
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              {sortedDates.map((date, di) => (
                <div key={date}>
                  <div className={`px-4 py-2 bg-[var(--bg)] border-b border-[var(--border)] ${di === 0 ? '' : 'border-t'}`}>
                    <span className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">
                      {date.slice(8, 10)}/{date.slice(5, 7)}
                    </span>
                  </div>
                  {grouped[date].map((exp, i) => {
                    const cfg = getCategoryDisplay(exp.category, customs);
                    const isLast = i === grouped[date].length - 1 && di === sortedDates.length - 1;
                    return (
                      <div
                        key={exp.id}
                        className={`px-4 py-3 flex items-center gap-3 ${!isLast ? 'border-b border-[var(--border)]' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${cfg?.bgClass ?? 'bg-[var(--bg)]'}`}>
                          {cfg?.icon ?? '💸'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text)] truncate">
                            {exp.description.charAt(0).toUpperCase() + exp.description.slice(1)}
                          </p>
                          <p className="text-xs text-[var(--text-2)]">{exp.category}</p>
                        </div>
                        <span className="font-semibold text-sm text-red-500 whitespace-nowrap flex-shrink-0">
                          −{formatCurrency(exp.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between bg-[var(--bg)]">
                <span className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                  Total
                </span>
                <span className="font-bold text-sm text-red-500">
                  −{formatCurrency(expensesTotal)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </main>
  );
}

export default function CartaoDetalhePage() {
  return (
    <Suspense fallback={null}>
      <CartaoDetalheInner />
    </Suspense>
  );
}
