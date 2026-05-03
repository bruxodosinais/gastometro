'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, Pause, Play, Trash2 } from 'lucide-react';
import {
  addObligationForNewRecurring,
  addRecurringExpense,
  deleteRecurringExpense,
  getMonthlyObligations,
  getRecurringExpenses,
  markObligationAsPaid,
  toggleRecurringExpense,
} from '@/lib/storage';
import { formatCurrency } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import {
  Category,
  EntryType,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  MonthlyObligation,
  RecurringExpense,
} from '@/lib/types';

export default function RecorrentesPage() {
  const [recurrings, setRecurrings] = useState<RecurringExpense[]>([]);
  const [obligations, setObligations] = useState<MonthlyObligation[]>([]);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // form
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Alimentação');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    Promise.all([getRecurringExpenses(), getMonthlyObligations(currentMonth)]).then(
      ([recs, obs]) => {
        setRecurrings(recs);
        setObligations(obs);
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
    const due = dueDay ? parseInt(dueDay, 10) : day;
    if (!num || num <= 0 || !description.trim() || !day || day < 1 || day > 31) return;
    if (dueDay && (due < 1 || due > 31)) return;

    setSaving(true);
    setFormError(null);
    try {
      const saved = await addRecurringExpense({
        description: description.trim(),
        amount: num,
        category,
        type: entryType,
        dayOfMonth: day,
        dueDay: due,
        active: true,
      });
      setRecurrings((prev) => [saved, ...prev]);

      // Cria obrigação para o mês atual imediatamente
      if (saved.type === 'expense') {
        const ob = await addObligationForNewRecurring(saved);
        if (ob) setObligations((prev) => [...prev, ob].sort((a, b) => a.dueDay - b.dueDay));
      }

      setAmount('');
      setDescription('');
      setDayOfMonth('');
      setDueDay('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rec: RecurringExpense) {
    const next = !rec.active;
    setRecurrings((prev) => prev.map((r) => (r.id === rec.id ? { ...r, active: next } : r)));
    await toggleRecurringExpense(rec.id, next);
  }

  async function handleDelete(id: string) {
    setRecurrings((prev) => prev.filter((r) => r.id !== id));
    await deleteRecurringExpense(id);
  }

  async function handleMarkObligationPaid(obligationId: string) {
    const ob = obligations.find((o) => o.id === obligationId);
    if (!ob || payingIds.has(obligationId)) return;
    setPayingIds((prev) => new Set([...prev, obligationId]));
    setObligations((prev) =>
      prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid' as const } : o))
    );
    try {
      await markObligationAsPaid(obligationId, ob);
    } catch {
      setObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'pending' as const } : o))
      );
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.delete(obligationId);
        return next;
      });
    }
  }

  const categories = entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' });
  const todayDay = new Date().getDate();

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-mint-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Recorrentes</h1>
      <p className="text-gray-500 text-sm mb-5">Gastos e receitas fixos mensais</p>

      <div className="md:grid md:grid-cols-[420px_1fr] md:gap-8 md:items-start">

        {/* Formulário de cadastro */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 md:mb-0 space-y-4"
        >
          <p className="text-gray-700 text-sm font-semibold">Novo recorrente</p>

          {/* Toggle Gasto / Receita */}
          <div className="flex p-1 bg-gray-50 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
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
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
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
              placeholder={
                entryType === 'expense'
                  ? 'Ex: Netflix, Academia, Aluguel...'
                  : 'Ex: Salário, Freela mensal...'
              }
              maxLength={80}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
            />
          </div>

          {/* Dia do mês + Dia de vencimento — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                Dia de lançamento
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                placeholder="Ex: 1"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
              />
              <p className="text-gray-500 text-xs mt-1">Quando entra no histórico</p>
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                Dia de vencimento
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder={dayOfMonth || 'Ex: 5'}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
              />
              <p className="text-gray-500 text-xs mt-1">Limite p/ pagar sem atraso</p>
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-2">
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
                        : 'bg-gray-50/50 border-gray-200 text-gray-500 hover:border-slate-600'
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
            className={`w-full py-3.5 rounded-xl font-semibold text-gray-900 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 ${
              entryType === 'income'
                ? 'bg-mint hover:bg-mint'
                : 'bg-mint hover:bg-mint-700'
            }`}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Cadastrar recorrente'}
          </button>
        </form>

        {/* Lista de recorrentes */}
        <div>
          <h2 className="text-gray-800 font-semibold text-sm mb-2">
            Cadastrados
            {recurrings.length > 0 && (
              <span className="ml-2 text-gray-500 font-normal">· {currentMonth}</span>
            )}
          </h2>

          {recurrings.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              Nenhum recorrente cadastrado ainda
            </p>
          ) : (
            <div className="space-y-2">
              {recurrings.map((rec) => {
                const cfg = CATEGORY_CONFIG[rec.category];
                const isIncome = rec.type === 'income';
                const obligation = obligations.find((o) => o.recurringExpenseId === rec.id);
                const isPaid = obligation?.status === 'paid';
                const isPaying = obligation ? payingIds.has(obligation.id) : false;
                const effectiveDueDay = rec.dueDay ?? rec.dayOfMonth;
                const daysLate = obligation && !isPaid && todayDay > effectiveDueDay
                  ? todayDay - effectiveDueDay : 0;
                const dueToday = obligation && !isPaid && todayDay === effectiveDueDay;

                return (
                  <div
                    key={rec.id}
                    className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${
                      rec.active ? 'border-gray-100' : 'border-gray-100 opacity-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-medium truncate">{rec.description}</p>
                      <p className="text-gray-500 text-xs">{rec.category} · Dia {rec.dayOfMonth}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`font-semibold text-sm ${isIncome ? 'text-mint-500' : 'text-gray-900'}`}>
                        {isIncome ? '+' : ''}{formatCurrency(rec.amount)}
                      </span>
                      {rec.type === 'expense' && rec.active && obligation && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
                          isPaid
                            ? 'bg-mint-50 text-mint-500 border-green-500/20'
                            : daysLate > 0
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : dueToday
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-gray-100/50 text-gray-500 border-gray-200'
                        }`}>
                          {isPaid
                            ? `✅ Pago em ${currentMonthName}`
                            : daysLate > 0
                            ? `🔴 Atrasado ${daysLate}d`
                            : dueToday
                            ? `⚠️ Vence hoje`
                            : `⏳ Vence dia ${effectiveDueDay}`}
                        </span>
                      )}
                    </div>

                    {/* Botão marcar como pago */}
                    {rec.type === 'expense' && rec.active && obligation && !isPaid && (
                      <button
                        onClick={() => handleMarkObligationPaid(obligation.id)}
                        disabled={isPaying}
                        className="w-7 h-7 rounded-lg bg-mint-50 border border-emerald-500/25 flex items-center justify-center text-mint-500 hover:bg-mint-50 transition-colors flex-shrink-0 disabled:opacity-50"
                        title="Marcar como pago"
                      >
                        {isPaying ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </button>
                    )}

                    <button
                      onClick={() => handleToggle(rec)}
                      className={`transition-colors flex-shrink-0 ${
                        rec.active ? 'text-gray-500 hover:text-yellow-400' : 'text-gray-500 hover:text-mint-500'
                      }`}
                      aria-label={rec.active ? 'Pausar' : 'Ativar'}
                    >
                      {rec.active ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
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
