'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, Loader2, MoreHorizontal, Pause, Play, Trash2 } from 'lucide-react';
import CategoryPickerSheet from '@/components/CategoryPickerSheet';
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
  const [inputFocused, setInputFocused] = useState(false);
  const [inputScale, setInputScale] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    if (!openMenuId) return;
    function close() { setOpenMenuId(null); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

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
    setShowCategoryPicker(false);
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

  const hasAmount = amount !== '' && amount !== '0';
  const glowColor = entryType === 'expense'
    ? 'drop-shadow(0 0 12px rgba(248, 113, 113, 0.3))'
    : 'drop-shadow(0 0 12px rgba(74, 222, 128, 0.3))';
  const valueColor = hasAmount
    ? entryType === 'expense' ? 'text-red-400' : 'text-mint-500'
    : 'text-gray-900';
  const prefixColor = hasAmount
    ? entryType === 'expense' ? 'text-red-400/50' : 'text-mint-500/50'
    : 'text-gray-500';
  const todayDay = new Date().getDate();
  const totalMonthlyAmount = recurrings
    .filter((r) => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

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
          <div className="flex p-1 rounded-[10px] h-11" style={{ backgroundColor: '#F3F4F6' }}>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex-1 rounded-[8px] text-sm font-semibold transition-all duration-200 ease-in-out ${
                entryType === 'expense'
                  ? 'text-white'
                  : 'bg-transparent text-[#6B7280]'
              }`}
              style={entryType === 'expense' ? { backgroundColor: '#EF4444', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' } : {}}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex-1 rounded-[8px] text-sm font-semibold transition-all duration-200 ease-in-out ${
                entryType === 'income'
                  ? 'text-white'
                  : 'bg-transparent text-[#6B7280]'
              }`}
              style={entryType === 'income' ? { backgroundColor: '#10B981', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' } : {}}
            >
              Receita
            </button>
          </div>

          {/* Valor */}
          <div
            className="flex items-center justify-center gap-2 py-2"
            style={{
              filter: inputFocused ? glowColor : 'none',
              transition: 'filter 200ms ease',
            }}
          >
            <span className={`text-3xl font-semibold select-none transition-colors duration-200 ${prefixColor}`}>
              R$
            </span>
            <div className="relative w-48">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9.,]/g, ''));
                  setInputScale(true);
                  setTimeout(() => setInputScale(false), 100);
                }}
                onFocus={(e) => {
                  setInputFocused(true);
                  if (e.target.value === '0') setAmount('');
                }}
                onBlur={() => setInputFocused(false)}
                placeholder="0"
                required
                className={`text-6xl font-bold bg-transparent border-none outline-none text-center w-full pb-1 placeholder:text-slate-700 transition-colors duration-200 ${valueColor}`}
                style={{
                  transform: inputScale ? 'scale(1.02)' : 'scale(1)',
                  transition: 'transform 100ms ease-out, color 200ms ease',
                  caretColor: entryType === 'expense' ? '#f87171' : '#4ade80',
                  cursor: inputFocused ? 'text' : 'pointer',
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: '#7C3AED' }} />
              <div
                className="absolute bottom-0 left-0 h-[2px]"
                style={{ backgroundColor: '#6D28D9', width: inputFocused ? '100%' : '0%', transition: 'width 200ms ease' }}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-gray-500 text-xs font-medium block mb-1.5">
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
              className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#7C3AED] transition-colors"
            />
          </div>

          {/* Dia do mês + Dia de vencimento — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs font-medium block mb-1.5">
                Dia de lançamento
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                placeholder="Ex: 1 (dia do mês)"
                required
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#7C3AED] transition-colors"
              />
              <p className="text-gray-500 text-xs mt-1">Quando aparece no histórico</p>
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium block mb-1.5">
                Dia de vencimento
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="Ex: 10"
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#7C3AED] transition-colors"
              />
              <p className="text-gray-500 text-xs mt-1">Limite para pagar sem atraso</p>
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-gray-500 text-xs font-medium block mb-1.5">
              Categoria
            </label>
            <button
              type="button"
              onClick={() => setShowCategoryPicker(true)}
              className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 flex items-center gap-2.5 text-left transition-colors hover:border-[#7C3AED]"
            >
              <span className="text-lg leading-none flex-shrink-0">{CATEGORY_CONFIG[category].icon}</span>
              <span className="flex-1 text-sm text-gray-900 font-medium">{category}</span>
              <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
            </button>
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
            className="w-full mt-6 h-[52px] rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 bg-[#7C3AED] hover:bg-[#6d28d9]"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Cadastrar recorrente'}
          </button>
        </form>

        {/* Lista de recorrentes */}
        <div>
          <div className="flex items-center gap-3 pt-6 md:pt-0 mb-4">
            <div className="flex-1 h-px bg-gray-100" />
            <h2 className="text-gray-800 font-semibold text-sm whitespace-nowrap">
              Cadastrados
              {recurrings.length > 0 && (
                <span className="ml-1 text-gray-500 font-normal">· {currentMonth}</span>
              )}
            </h2>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {recurrings.length > 0 && (
            <p className="text-gray-400 text-xs mb-3">
              {recurrings.filter((r) => r.active).length} recorrentes
              {totalMonthlyAmount > 0 && ` · ${formatCurrency(totalMonthlyAmount)} total`}
            </p>
          )}

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
                const hasObligation = rec.type === 'expense' && rec.active && !!obligation;

                // left border color per state
                const leftBorderColor = !hasObligation
                  ? 'transparent'
                  : isPaid
                  ? '#10B981'
                  : daysLate > 0
                  ? '#EF4444'
                  : '#F59E0B';

                // card background tint per state
                const cardBgClass = !hasObligation
                  ? 'bg-white'
                  : isPaid
                  ? 'bg-[#F0FDF4]'
                  : daysLate > 0
                  ? 'bg-[#FEF2F2]'
                  : 'bg-[#FFFBEB]';

                // badge
                const badgeClass = isPaid
                  ? 'bg-emerald-500 text-white'
                  : daysLate > 0
                  ? 'bg-red-500 text-white'
                  : 'bg-amber-500/20 text-amber-700';
                const badgeText = isPaid
                  ? 'Pago'
                  : daysLate > 0
                  ? `Atrasado ${daysLate}d`
                  : todayDay === effectiveDueDay
                  ? 'Vence hoje'
                  : `Vence dia ${effectiveDueDay}`;

                const contentOpacity = isPaid ? 'opacity-60' : '';
                const isMenuOpen = openMenuId === rec.id;

                return (
                  <div
                    key={rec.id}
                    className={`border border-[#F3F4F6] rounded-xl transition-all ${cardBgClass} ${!rec.active ? 'opacity-50' : ''}`}
                    style={{
                      padding: '12px 14px',
                      borderLeftWidth: '3px',
                      borderLeftColor: leftBorderColor,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Category icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${cfg.bgClass} ${contentOpacity}`}>
                        {cfg.icon}
                      </div>

                      {/* Content — both rows */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: name + value + menu */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className={`flex-1 min-w-0 text-sm font-medium text-gray-900 truncate ${contentOpacity}`}>
                            {rec.description}
                          </p>
                          <span className={`font-bold text-sm flex-shrink-0 ${isIncome ? 'text-mint-500' : 'text-gray-900'} ${contentOpacity}`}>
                            {isIncome ? '+' : ''}{formatCurrency(rec.amount)}
                          </span>

                          {/* Three-dot menu */}
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : rec.id);
                              }}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                              aria-label="Mais opções"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                            {isMenuOpen && (
                              <div className="absolute right-0 top-7 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[120px]">
                                <button
                                  onClick={() => { handleToggle(rec); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  {rec.active ? <Pause size={12} /> : <Play size={12} />}
                                  {rec.active ? 'Pausar' : 'Ativar'}
                                </button>
                                <button
                                  onClick={() => { handleDelete(rec.id); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={12} />
                                  Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Row 2: meta + badge + mark-paid */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-400 text-xs flex-1 min-w-0 truncate">
                            {rec.category} · Dia {rec.dayOfMonth}
                          </span>
                          {hasObligation && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${badgeClass}`}>
                              {badgeText}
                            </span>
                          )}
                          {hasObligation && !isPaid && (
                            <button
                              onClick={() => handleMarkObligationPaid(obligation!.id)}
                              disabled={isPaying}
                              className="flex-shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {isPaying
                                ? <Loader2 size={10} className="animate-spin" />
                                : 'Marcar pago'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CategoryPickerSheet
        open={showCategoryPicker}
        categories={categories}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
        columns={entryType === 'expense' ? 4 : 2}
      />
    </main>
  );
}
