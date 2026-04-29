'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { addExpense, updateExpense } from '@/lib/storage';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  Category,
  EntryType,
  Expense,
} from '@/lib/types';

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
  const [category, setCategory] = useState<Category>(expense.category);
  const [date, setDate] = useState(mode === 'duplicate' ? todayStr() : expense.date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const title = mode === 'duplicate' ? 'Duplicar lançamento' : 'Editar lançamento';
  const submitLabel = mode === 'duplicate' ? 'Criar cópia' : 'Salvar alterações';

  function handleTypeChange(type: EntryType) {
    setEntryType(type);
    setCategory(type === 'expense' ? 'Alimentação' : 'Salário');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || num <= 0 || !description.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const payload = { type: entryType, amount: num, description: description.trim(), category, date };
      const saved =
        mode === 'duplicate'
          ? await addExpense(payload)
          : await updateExpense(expense.id, payload);
      onSave(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet no mobile · dialog centralizado no desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:inset-0 md:flex md:items-center md:justify-center md:px-4">
        <div className="bg-slate-900 border-t border-slate-800 rounded-t-2xl md:border md:rounded-2xl md:w-full md:max-w-md">
          {/* Handle bar — só aparece no mobile */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 bg-slate-700 rounded-full" />
          </div>

          <div className="px-5 pb-6 pt-3 md:pt-5 overflow-y-auto max-h-[88vh] md:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-base">{title}</h2>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors p-1"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Toggle Gasto / Receita */}
              <div className="flex p-1 bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    entryType === 'expense'
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    entryType === 'income'
                      ? 'bg-slate-900 text-green-400 shadow'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Receita
                </button>
              </div>

              {/* Valor */}
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Valor (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-lg font-semibold placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Descrição
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={entryType === 'expense' ? 'Ex: iFood, Supermercado...' : 'Ex: Salário maio, Projeto X...'}
                  maxLength={80}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Data */}
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Data
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-2">
                  Categoria
                </label>
                <div className={`grid gap-2 ${entryType === 'expense' ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  {categories.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const active = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                          active
                            ? `${cfg.bgClass} ${cfg.borderClass} ${cfg.textClass}`
                            : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-lg">{cfg.icon}</span>
                        <span className="text-[10px] leading-tight text-center">{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100 ${
                  entryType === 'income'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-violet-600 hover:bg-violet-500'
                }`}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : submitLabel}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
