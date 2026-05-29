'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { addExpense, getCreditCards, updateExpense } from '@/lib/storage';
import LoadingButton from '@/components/ui/LoadingButton';
import {
  CreditCard as CreditCardType,
  EntryType,
  Expense,
} from '@/lib/types';
import { useCategorySelector } from '@/hooks/useCategorySelector';

function todayStr() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  expense: Expense;
  mode?: 'edit' | 'duplicate';
  onSave: (saved: Expense) => void;
  onClose: () => void;
}

export default function EditExpenseModal({ expense, mode = 'edit', onSave, onClose }: Props) {
  const [entryType, setEntryType] = useState<EntryType>(expense.type);
  const [amount, setAmount] = useState(String(expense.amount));
  const [description, setDescription] = useState(expense.description);
  const [category, setCategory] = useState<string>(expense.category);
  const [date, setDate] = useState(mode === 'duplicate' ? todayStr() : expense.date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCredit, setIsCredit] = useState(expense.isCredit ?? false);
  const [selectedCardId, setSelectedCardId] = useState(expense.creditCardId ?? '');
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);

  // Trava o scroll do body enquanto o modal de edição está aberto e restaura
  // no unmount (fechar, salvar ou navegar) — evita a página rolar por trás.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (expense.type === 'expense') {
      getCreditCards().then((cards) => {
        setCreditCards(cards);
        if (!expense.creditCardId && cards.length > 0) setSelectedCardId(cards[0].id);
      });
    }
  }, [expense.type, expense.creditCardId]);

  const { categories: categoryOptions } = useCategorySelector(entryType);
  const title = mode === 'duplicate' ? 'Duplicar lançamento' : 'Editar lançamento';
  const submitLabel = mode === 'duplicate' ? 'Criar cópia' : 'Salvar alterações';

  function handleTypeChange(type: EntryType) {
    setEntryType(type);
    setCategory(type === 'expense' ? 'Alimentação' : 'Salário');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ── Validação de edge cases ANTES de chamar o Supabase ──
    const rawAmount = amount.trim();
    if (!rawAmount) {
      setError('Informe o valor.');
      return;
    }
    // O input é type="number" (numérico puro): seu .value nunca traz separador
    // de milhar nem vírgula. parseFloat já basta — o replace(',','.') é só uma
    // rede de segurança p/ teclados mobile que emitem vírgula. NÃO remover
    // pontos aqui: "150.50" viraria 15050.
    const num = parseFloat(rawAmount.replace(',', '.'));
    if (Number.isNaN(num)) {
      setError('Valor inválido.');
      return;
    }
    if (num <= 0) {
      setError('O valor deve ser maior que zero.');
      return;
    }
    if (!description.trim()) {
      setError('Informe uma descrição.');
      return;
    }
    if (!category || !categoryOptions.some((o) => o.value === category)) {
      setError('Selecione uma categoria.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        type: entryType,
        amount: num,
        description: description.trim(),
        category,
        date,
        ...(entryType === 'expense' && isCredit && selectedCardId
          ? { isCredit: true, creditCardId: selectedCardId }
          : { isCredit: false, creditCardId: undefined }),
      };
      // Diagnóstico sem PII: só id + modo (sem valor, descrição ou payload).
      console.log('[EditExpenseModal] salvando', { id: expense.id, mode });
      const saved =
        mode === 'duplicate'
          ? await addExpense(payload)
          : await updateExpense(expense.id, payload);
      console.log('[EditExpenseModal] persistido', { id: saved.id });
      onSave(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop — cobre toda a tela atrás do modal */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Modal centralizado na tela (não cresce indefinidamente) */}
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="bg-white border border-gray-100 rounded-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-5 pb-6 pt-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-900 font-semibold text-base">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-900 transition-colors p-1 touch-manipulation"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Toggle Gasto / Receita */}
              <div className="flex p-1 bg-gray-50 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all touch-manipulation ${
                    entryType === 'expense'
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all touch-manipulation ${
                    entryType === 'income'
                      ? 'bg-white text-mint-500 shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Receita
                </button>
              </div>

              {/* Valor */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Valor (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 text-lg font-semibold placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Descrição
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={entryType === 'expense' ? 'Ex: iFood, Supermercado...' : 'Ex: Salário maio, Projeto X...'}
                  maxLength={80}
                  required
                  style={{ fontSize: '16px' }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                />
              </div>

              {/* Data */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Data
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  style={{ fontSize: '16px' }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-mint-500 transition-colors"
                />
              </div>

              {/* Cartão de crédito */}
              {entryType === 'expense' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-500 text-xs font-medium uppercase tracking-wider">
                      Pagar com cartão
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCredit((v) => !v)}
                      className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none touch-manipulation"
                      style={{ backgroundColor: isCredit ? '#00b87a' : '#D1D5DB' }}
                      role="switch"
                      aria-checked={isCredit}
                    >
                      <span
                        className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out"
                        style={{ margin: 2, transform: isCredit ? 'translateX(16px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                  {isCredit && creditCards.length > 0 && (
                    <select
                      value={selectedCardId}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                      style={{ fontSize: '16px' }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-mint-500 transition-colors"
                    >
                      {creditCards.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  )}
                  {isCredit && creditCards.length === 0 && (
                    <p className="text-xs text-gray-500">
                      Nenhum cartão cadastrado.{' '}
                      <a href="/cartoes" className="text-blue-500 underline">Adicionar →</a>
                    </p>
                  )}
                </div>
              )}

              {/* Categoria */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-2">
                  Categoria
                </label>
                {(() => {
                  const fixed = categoryOptions.filter((o) => !o.isCustom);
                  const custom = categoryOptions.filter((o) => o.isCustom);
                  const gridCols = entryType === 'expense' ? 'grid-cols-4' : 'grid-cols-2';
                  const renderOpt = (opt: typeof categoryOptions[number]) => {
                    const active = category === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCategory(opt.value)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all touch-manipulation ${
                          active
                            ? 'bg-mint-50 border-green-500/40 text-mint-500'
                            : 'bg-gray-50/50 border-gray-200 text-gray-500 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-lg">{opt.icon}</span>
                        <span className="text-[10px] leading-tight text-center">{opt.label}</span>
                      </button>
                    );
                  };
                  return (
                    <div className="max-h-48 overflow-y-auto">
                      <div className={`grid gap-2 ${gridCols}`}>
                        {fixed.map(renderOpt)}
                      </div>
                      {custom.length > 0 && (
                        <>
                          <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mt-3 mb-2">
                            Minhas categorias
                          </p>
                          <div className={`grid gap-2 ${gridCols}`}>
                            {custom.map(renderOpt)}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <LoadingButton
                type="submit"
                loading={saving}
                className="w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100 touch-manipulation"
                style={{ background: 'var(--accent)' }}
              >
                {submitLabel}
              </LoadingButton>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
