'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Pause, Play, Trash2 } from 'lucide-react';
import {
  addRecurringExpense,
  deleteRecurringExpense,
  getLaunchedRecurringIds,
  getRecurringExpenses,
  toggleRecurringExpense,
} from '@/lib/storage';
import { formatCurrency } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import {
  Category,
  EntryType,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RecurringExpense,
} from '@/lib/types';

export default function RecorrentesPage() {
  const [recurrings, setRecurrings] = useState<RecurringExpense[]>([]);
  const [launchedIds, setLaunchedIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // form
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Alimentação');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getRecurringExpenses(), getLaunchedRecurringIds()]).then(
      ([recs, ids]) => {
        setRecurrings(recs);
        setLaunchedIds(ids);
        setReady(true);
      }
    );
  }, []);

  function handleTypeChange(type: EntryType) {
    setEntryType(type);
    setCategory(type === 'expense' ? 'Alimentação' : 'Salário');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    const day = parseInt(dayOfMonth, 10);
    if (!num || num <= 0 || !description.trim() || !day || day < 1 || day > 31) return;

    setSaving(true);
    setFormError(null);
    try {
      const saved = await addRecurringExpense({
        description: description.trim(),
        amount: num,
        category,
        type: entryType,
        dayOfMonth: day,
        active: true,
      });
      setRecurrings((prev) => [saved, ...prev]);
      setAmount('');
      setDescription('');
      setDayOfMonth('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rec: RecurringExpense) {
    const next = !rec.active;
    setRecurrings((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, active: next } : r))
    );
    await toggleRecurringExpense(rec.id, next);
  }

  async function handleDelete(id: string) {
    setRecurrings((prev) => prev.filter((r) => r.id !== id));
    await deleteRecurringExpense(id);
  }

  const categories = entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Recorrentes</h1>
      <p className="text-slate-400 text-sm mb-5">Gastos e receitas fixos mensais</p>

      <div className="md:grid md:grid-cols-[420px_1fr] md:gap-8 md:items-start">

        {/* Formulário de cadastro */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 md:mb-0 space-y-4"
        >
          <p className="text-slate-300 text-sm font-semibold">Novo recorrente</p>

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
              placeholder={
                entryType === 'expense'
                  ? 'Ex: Netflix, Academia, Aluguel...'
                  : 'Ex: Salário, Freela mensal...'
              }
              maxLength={80}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Dia do mês */}
          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Dia do mês para lançar
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="Ex: 5"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <p className="text-slate-600 text-xs mt-1">
              Meses sem esse dia usam o último dia disponível
            </p>
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

          {formError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 ${
              entryType === 'income'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-violet-600 hover:bg-violet-500'
            }`}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Cadastrar recorrente'}
          </button>
        </form>

        {/* Lista de recorrentes */}
        <div>
          <h2 className="text-slate-200 font-semibold text-sm mb-2">
            Cadastrados
            {recurrings.length > 0 && (
              <span className="ml-2 text-slate-500 font-normal">· {currentMonth}</span>
            )}
          </h2>

          {recurrings.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">
              Nenhum recorrente cadastrado ainda
            </p>
          ) : (
            <div className="space-y-2">
              {recurrings.map((rec) => {
                const cfg = CATEGORY_CONFIG[rec.category];
                const isIncome = rec.type === 'income';
                const launched = launchedIds.has(rec.id);
                return (
                  <div
                    key={rec.id}
                    className={`bg-slate-900 border rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${
                      rec.active ? 'border-slate-800' : 'border-slate-800/50 opacity-50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}
                    >
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{rec.description}</p>
                      <p className="text-slate-500 text-xs">
                        {rec.category} · Dia {rec.dayOfMonth}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`font-semibold text-sm ${
                          isIncome ? 'text-green-400' : 'text-white'
                        }`}
                      >
                        {isIncome ? '+' : ''}
                        {formatCurrency(rec.amount)}
                      </span>
                      {launched && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                          lançado
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggle(rec)}
                      className={`transition-colors flex-shrink-0 ${
                        rec.active
                          ? 'text-slate-600 hover:text-yellow-400'
                          : 'text-slate-600 hover:text-green-400'
                      }`}
                      aria-label={rec.active ? 'Pausar' : 'Ativar'}
                    >
                      {rec.active ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                      aria-label="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
