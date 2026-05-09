'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  addExpense,
  getCreditCards,
  getCreditCardFatura,
  getExpensesByCard,
} from '@/lib/storage';
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { Category, CreditCard as CreditCardType, Expense } from '@/lib/types';

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

export default function CartaoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.id as string;

  const [card, setCard] = useState<CreditCardType | null>(null);
  const [period, setPeriod] = useState(todayPeriod());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fatura, setFatura] = useState(0);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  useEffect(() => {
    getCreditCards().then((cards) => {
      const found = cards.find((c) => c.id === cardId);
      if (!found) { router.push('/cartoes'); return; }
      setCard(found);
    });
  }, [cardId, router]);

  useEffect(() => {
    if (!card) return;
    setReady(false);
    Promise.all([
      getExpensesByCard(cardId, period),
      getCreditCardFatura(cardId, period),
    ]).then(([exps, total]) => {
      setExpenses(exps);
      setFatura(total);
      setReady(true);
      setPaySuccess(false);
    });
  }, [card, cardId, period]);

  async function handlePayFatura() {
    if (!card || fatura <= 0 || paying) return;
    setPaying(true);
    try {
      await addExpense({
        type: 'expense',
        amount: fatura,
        description: `Pagamento fatura ${card.nome}`,
        category: 'Serviços' as Category,
        date: todayStr(),
        isCredit: false,
        creditCardId: undefined,
      });
      setPaySuccess(true);
    } finally {
      setPaying(false);
    }
  }

  const fatPct = card && card.limite > 0 ? Math.min((fatura / card.limite) * 100, 100) : 0;
  const isCurrentPeriod = period === todayPeriod();

  const grouped = expenses.reduce<Record<string, Expense[]>>((acc, exp) => {
    if (!acc[exp.date]) acc[exp.date] = [];
    acc[exp.date].push(exp);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <main className="max-w-lg md:max-w-[600px] mx-auto px-4 pt-8 pb-28">
      <button
        onClick={() => router.push('/cartoes')}
        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        Cartões
      </button>

      {!card ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Card header */}
          <div
            className="bg-white border border-gray-100 rounded-2xl p-5 mb-4"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">💳</span>
              </div>
              <div>
                <h1 className="text-gray-900 font-bold text-lg leading-tight">{card.nome}</h1>
                <p className="text-gray-500 text-sm">Limite {formatCurrency(card.limite)}</p>
              </div>
            </div>

            {(card.diaFechamento || card.diaVencimento) && (
              <div className="flex gap-4 text-xs text-gray-500 mb-4">
                {card.diaFechamento && <span>Fecha dia {card.diaFechamento}</span>}
                {card.diaVencimento && <span>Vence dia {card.diaVencimento}</span>}
              </div>
            )}

            {/* Period selector */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-gray-700 capitalize">
                {getMonthLabel(period)}
              </span>
              <button
                onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
                disabled={isCurrentPeriod}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Fatura total + progress */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">
                Fatura {period.slice(5, 7)}/{period.slice(0, 4)}
              </span>
              <span
                className="text-base font-bold"
                style={{ color: fatura > 0 ? '#f04e5e' : '#9ca3af' }}
              >
                {formatCurrency(fatura)}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fatPct}%`,
                  background: fatPct >= 90 ? '#ef4444' : fatPct >= 70 ? '#f97316' : '#3b82f6',
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 text-right mb-4">
              {Math.round(fatPct)}% do limite utilizado
            </p>

            {/* Pay button */}
            {fatura > 0 && (
              <button
                onClick={handlePayFatura}
                disabled={paying || paySuccess}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                style={{ background: paySuccess ? '#10b981' : 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                {paying ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : paySuccess ? (
                  '✓ Fatura paga!'
                ) : (
                  `Pagar fatura · ${formatCurrency(fatura)}`
                )}
              </button>
            )}
          </div>

          {/* Expense list */}
          <h2 className="text-gray-800 font-semibold text-sm mb-3">
            Lançamentos na fatura
          </h2>

          {!ready ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : expenses.length === 0 ? (
            <div
              className="bg-white border border-gray-100 rounded-2xl py-10 text-center"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <p className="text-3xl mb-2">📭</p>
              <p className="text-gray-500 text-sm">Nenhum lançamento neste período</p>
            </div>
          ) : (
            <div
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              {sortedDates.map((date, di) => (
                <div key={date}>
                  <div className={`px-4 py-2 bg-gray-50 border-b border-gray-100 ${di === 0 ? '' : 'border-t'}`}>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      {date.slice(8, 10)}/{date.slice(5, 7)}
                    </span>
                  </div>
                  {grouped[date].map((exp, i) => {
                    const cfg = CATEGORY_CONFIG[exp.category];
                    const isLast = i === grouped[date].length - 1 && di === sortedDates.length - 1;
                    return (
                      <div
                        key={exp.id}
                        className={`px-4 py-3 flex items-center gap-3 ${!isLast ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${cfg?.bgClass ?? 'bg-gray-50'}`}>
                          {cfg?.icon ?? '💸'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {exp.description.charAt(0).toUpperCase() + exp.description.slice(1)}
                          </p>
                          <p className="text-xs text-gray-500">{exp.category}</p>
                        </div>
                        <span className="font-semibold text-sm text-red-500 whitespace-nowrap flex-shrink-0">
                          −{formatCurrency(exp.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total
                </span>
                <span className="font-bold text-sm text-red-500">
                  −{formatCurrency(fatura)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
