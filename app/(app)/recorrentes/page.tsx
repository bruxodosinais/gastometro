'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Pause, Play, Trash2 } from 'lucide-react';
import CategoryPickerSheet from '@/components/CategoryPickerSheet';
import {
  addObligationForNewRecurring,
  addRecurringExpense,
  deleteRecurringExpense,
  getMonthlyObligations,
  getRecurringExpenses,
  markObligationAsPaid,
  unmarkObligationAsPaid,
  toggleRecurringExpense,
} from '@/lib/storage';
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import {
  Category,
  EntryType,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  MonthlyObligation,
  RecurringExpense,
} from '@/lib/types';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function findSimilarRecurring(desc: string, recurrings: RecurringExpense[]): RecurringExpense | null {
  const normalize = (s: string) =>
    s.toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const input = normalize(desc);
  if (input.length < 3) return null;
  const active = recurrings.filter((r) => r.active);
  for (const r of active) {
    if (normalize(r.description) === input) return r;
  }
  const inputWords = input.split(' ').filter((w) => w.length >= 3);
  for (const r of active) {
    const existingWords = normalize(r.description).split(' ').filter((w) => w.length >= 3);
    if (inputWords.some((w) => existingWords.includes(w))) return r;
  }
  return null;
}

export default function RecorrentesPage() {
  const todayMonthKey = new Date().toISOString().slice(0, 7);

  const [recurrings, setRecurrings] = useState<RecurringExpense[]>([]);
  const [obligations, setObligations] = useState<MonthlyObligation[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(todayMonthKey);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());
  const [paidExpenseIds, setPaidExpenseIds] = useState<Map<string, string>>(new Map());
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
  const [activeTab, setActiveTab] = useState<'all' | 'pendentes' | 'pagas'>('all');
  const [duplicateWarning, setDuplicateWarning] = useState<RecurringExpense | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => parseInt(todayMonthKey.split('-')[0]));

  const isFirstLoad = useRef(true);

  const isCurrentMonth = selectedMonth === todayMonthKey;
  const isPastMonth = selectedMonth < todayMonthKey;
  const isFutureMonth = selectedMonth > todayMonthKey;

  useEffect(() => {
    if (!openMenuId) return;
    function close() { setOpenMenuId(null); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'pendentes') setActiveTab('pendentes');

    Promise.all([getRecurringExpenses(), getMonthlyObligations(todayMonthKey)]).then(
      ([recs, obs]) => {
        setRecurrings(recs);
        setObligations(obs);
        setReady(true);
        isFirstLoad.current = false;
      }
    );
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) return;
    setLoadingMonth(true);
    getMonthlyObligations(selectedMonth).then((obs) => {
      setObligations(obs);
      setLoadingMonth(false);
    });
  }, [selectedMonth]);

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

      if (saved.type === 'expense') {
        const ob = await addObligationForNewRecurring(saved);
        if (ob) setObligations((prev) => [...prev, ob].sort((a, b) => a.dueDay - b.dueDay));
      }

      setAmount('');
      setDescription('');
      setDayOfMonth('');
      setDueDay('');
      setDuplicateWarning(null);
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
    const optimisticPaidAt = new Date().toISOString();
    setObligations((prev) =>
      prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid' as const, paidAt: optimisticPaidAt } : o))
    );
    try {
      const { expense } = await markObligationAsPaid(obligationId, ob);
      setPaidExpenseIds((prev) => new Map(prev).set(obligationId, expense.id));
    } catch {
      setObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'pending' as const, paidAt: undefined } : o))
      );
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.delete(obligationId);
        return next;
      });
    }
  }

  async function handleUnmarkObligationPaid(obligationId: string) {
    const expenseId = paidExpenseIds.get(obligationId);
    if (!expenseId || undoingIds.has(obligationId)) return;
    setUndoingIds((prev) => new Set([...prev, obligationId]));
    setObligations((prev) =>
      prev.map((o) => (o.id === obligationId ? { ...o, status: 'pending' as const } : o))
    );
    try {
      await unmarkObligationAsPaid(obligationId, expenseId);
      setPaidExpenseIds((prev) => {
        const next = new Map(prev);
        next.delete(obligationId);
        return next;
      });
    } catch {
      setObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid' as const } : o))
      );
    } finally {
      setUndoingIds((prev) => {
        const next = new Set(prev);
        next.delete(obligationId);
        return next;
      });
    }
  }

  const categories = entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const selectedMonthLabel = getMonthLabel(selectedMonth);
  const selectedMonthLabelCap = selectedMonthLabel.charAt(0).toUpperCase() + selectedMonthLabel.slice(1);

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

  const filteredRecurrings = recurrings.filter((rec) => {
    if (activeTab === 'all') return true;
    const obligation = obligations.find((o) => o.recurringExpenseId === rec.id);
    const isPaid = obligation?.status === 'paid';
    if (isPastMonth) {
      if (activeTab === 'pendentes') return rec.type === 'expense' && rec.active && !isPaid;
      return rec.type === 'expense' && rec.active && isPaid;
    }
    if (isFutureMonth) {
      if (activeTab === 'pendentes') return rec.type === 'expense' && rec.active;
      return false;
    }
    // current month
    const hasObligation = rec.type === 'expense' && rec.active && !!obligation;
    if (activeTab === 'pendentes') return hasObligation && !isPaid;
    return hasObligation && isPaid;
  });

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
                  caretColor: '#00b87a',
                  cursor: inputFocused ? 'text' : 'pointer',
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: '#00b87a' }} />
              <div
                className="absolute bottom-0 left-0 h-[2px]"
                style={{ backgroundColor: '#00b87a', width: inputFocused ? '100%' : '0%', transition: 'width 200ms ease' }}
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
              onChange={(e) => {
                const val = e.target.value;
                setDescription(val);
                if (val.trim().length >= 3) {
                  setDuplicateWarning(findSimilarRecurring(val, recurrings));
                } else {
                  setDuplicateWarning(null);
                }
              }}
              placeholder={
                entryType === 'expense'
                  ? 'Ex: Netflix, Academia, Aluguel...'
                  : 'Ex: Salário, Freela mensal...'
              }
              maxLength={80}
              required
              className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#00b87a] transition-colors"
            />
            {duplicateWarning && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-amber-700 text-sm font-medium">
                  ⚠️ Já existe um recorrente parecido: <strong>{duplicateWarning.description}</strong>
                </p>
                <div className="flex gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => { setDescription(''); setDuplicateWarning(null); }}
                    className="text-xs text-amber-700 underline hover:text-amber-900 transition-colors"
                  >
                    Sim, cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="text-xs text-amber-700 underline hover:text-amber-900 transition-colors"
                  >
                    Não, cadastrar assim mesmo
                  </button>
                </div>
              </div>
            )}
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
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#00b87a] transition-colors"
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
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#00b87a] transition-colors"
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
              className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 flex items-center gap-2.5 text-left transition-colors hover:border-[#00b87a]"
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
            className="w-full mt-6 h-[52px] rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
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
                <span className="ml-1 text-gray-500 font-normal">· {selectedMonthLabel}</span>
              )}
            </h2>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Seletor de mês */}
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-1 py-1 mb-4">
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              onClick={() => { setPickerYear(parseInt(selectedMonth.split('-')[0])); setPickerOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-900 font-semibold text-sm">{selectedMonthLabelCap}</span>
              <ChevronDown size={13} className="text-gray-400" />
              {loadingMonth && <Loader2 size={12} className="animate-spin text-gray-400" />}
            </button>
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          {/* Popup picker de mês/ano */}
          {pickerOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={() => setPickerOpen(false)}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                  className="w-full max-w-xs bg-white border border-gray-200 rounded-2xl p-5 shadow-2xl pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Navegação de ano */}
                  <div className="flex items-center justify-between mb-5">
                    <button
                      onClick={() => setPickerYear((y) => y - 1)}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded-xl hover:bg-gray-50 transition-colors"
                      aria-label="Ano anterior"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-gray-900 font-bold text-xl">{pickerYear}</span>
                    <button
                      onClick={() => setPickerYear((y) => y + 1)}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded-xl hover:bg-gray-50 transition-colors"
                      aria-label="Próximo ano"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Grade de meses */}
                  <div className="grid grid-cols-3 gap-2">
                    {MONTHS.map((name, idx) => {
                      const month = idx + 1;
                      const key = `${pickerYear}-${String(month).padStart(2, '0')}`;
                      const isSelected = key === selectedMonth;
                      const isNow = key === todayMonthKey;
                      return (
                        <button
                          key={month}
                          onClick={() => { setSelectedMonth(key); setPickerOpen(false); }}
                          className={`py-3 rounded-xl text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                              : isNow
                              ? 'bg-gray-50 text-emerald-600 ring-1 ring-emerald-400/40'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Aviso ao navegar para outro mês */}
          {!isCurrentMonth && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
              Visualizando {selectedMonthLabel} — volte ao mês atual para gerenciar pagamentos
            </div>
          )}

          {recurrings.length > 0 && (
            <p className="text-gray-400 text-xs mb-3">
              {recurrings.filter((r) => r.active).length} recorrentes
              {totalMonthlyAmount > 0 && ` · ${formatCurrency(totalMonthlyAmount)} total`}
            </p>
          )}

          {recurrings.length > 0 && (
            <div className="flex items-center gap-4 mb-3">
              {(['all', 'pendentes', 'pagas'] as const).map((tab) => {
                const labels = { all: 'Ver tudo', pendentes: 'Pendentes', pagas: 'Pagas' };
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="pb-1 text-sm font-medium transition-colors"
                    style={{
                      color: isActive ? '#10b981' : '#9ca3af',
                      borderBottom: isActive ? '2px solid #10b981' : '2px solid transparent',
                    }}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
          )}

          {recurrings.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-5xl mb-3">🔄</p>
              <p className="text-gray-900 font-semibold text-lg mb-2">Nenhuma conta fixa cadastrada</p>
              <p className="text-gray-500 text-sm mx-auto max-w-[280px]">
                Cadastre contas que se repetem todo mês — aluguel, streaming, academia — e nunca perca um vencimento.
              </p>
            </div>
          ) : filteredRecurrings.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              Nenhum item nesta categoria
            </p>
          ) : (
            <div className="space-y-2">
              {filteredRecurrings.map((rec) => {
                const cfg = CATEGORY_CONFIG[rec.category];
                const isIncome = rec.type === 'income';
                const obligation = obligations.find((o) => o.recurringExpenseId === rec.id);
                const isPaid = obligation?.status === 'paid';
                const isPaying = obligation ? payingIds.has(obligation.id) : false;
                const effectiveDueDay = rec.dueDay ?? rec.dayOfMonth;

                // ── Badge & card state per month type ──────────────────────
                let badgeText = '';
                let badgeClass = '';
                let leftBorderColor = 'transparent';
                let cardBgClass = 'bg-white';
                let showMarkPaid = false;
                let showUndo = false;

                if (isCurrentMonth) {
                  // Se o recorrente foi criado neste mês DEPOIS do vencimento,
                  // não considerar como atrasado — só vale para meses em que
                  // o recorrente já existia desde o início.
                  const recCreatedThisMonth = rec.createdAt.slice(0, 7) === todayMonthKey;
                  const recCreatedDay = recCreatedThisMonth ? new Date(rec.createdAt).getDate() : 0;
                  const createdAfterDue = recCreatedThisMonth && recCreatedDay > effectiveDueDay;
                  const daysLate = obligation && !isPaid && todayDay > effectiveDueDay && !createdAfterDue
                    ? todayDay - effectiveDueDay : 0;
                  const hasObligation = rec.type === 'expense' && rec.active && !!obligation;

                  leftBorderColor = !hasObligation
                    ? 'transparent'
                    : isPaid ? '#10B981'
                    : daysLate > 0 ? '#EF4444'
                    : '#F59E0B';

                  cardBgClass = !hasObligation
                    ? 'bg-white'
                    : isPaid ? 'bg-[#F0FDF4]'
                    : daysLate > 0 ? 'bg-[#FEF2F2]'
                    : 'bg-[#FFFBEB]';

                  if (hasObligation) {
                    const paidAtLabel = (() => {
                      if (!obligation?.paidAt) return 'Pago';
                      const d = new Date(obligation.paidAt);
                      const dd = String(d.getDate()).padStart(2, '0');
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      return `Pago · ${dd}/${mm}`;
                    })();
                    badgeText = isPaid
                      ? paidAtLabel
                      : daysLate > 0 ? `Atrasado ${daysLate}d`
                      : todayDay === effectiveDueDay ? 'Vence hoje'
                      : `Vence dia ${effectiveDueDay}`;
                    badgeClass = isPaid
                      ? 'bg-emerald-500 text-white'
                      : daysLate > 0 ? 'bg-red-500 text-white'
                      : 'bg-amber-500/20 text-amber-700';
                    showMarkPaid = !isPaid;
                    showUndo = isPaid && paidExpenseIds.has(obligation!.id);
                  }
                } else if (isPastMonth) {
                  if (rec.type === 'expense' && rec.active) {
                    if (isPaid) {
                      const paidAtLabel = (() => {
                        if (!obligation?.paidAt) return 'Pago';
                        const d = new Date(obligation.paidAt);
                        const dd = String(d.getDate()).padStart(2, '0');
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        return `Pago · ${dd}/${mm}`;
                      })();
                      badgeText = paidAtLabel;
                      badgeClass = 'bg-emerald-500 text-white';
                      leftBorderColor = '#10B981';
                      cardBgClass = 'bg-[#F0FDF4]';
                    } else {
                      badgeText = 'Não pago';
                      badgeClass = 'bg-red-100 text-red-500';
                      leftBorderColor = '#FCA5A5';
                      cardBgClass = 'bg-[#FEF2F2]';
                    }
                  }
                } else {
                  // future month
                  if (rec.type === 'expense' && rec.active) {
                    badgeText = 'Previsto';
                    badgeClass = 'bg-gray-100 text-gray-500';
                  }
                }

                const contentOpacity = isCurrentMonth && isPaid ? 'opacity-60' : '';
                const isMenuOpen = openMenuId === rec.id;
                const showBadge = badgeText !== '';

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

                        {/* Row 2: meta + badge + mark-paid / desfazer */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-400 text-xs flex-1 min-w-0 truncate">
                            {rec.category} · Dia {rec.dayOfMonth}
                          </span>
                          {showBadge && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${badgeClass}`}>
                              {badgeText}
                            </span>
                          )}
                          {showMarkPaid && obligation && (
                            <button
                              onClick={() => handleMarkObligationPaid(obligation.id)}
                              disabled={isPaying}
                              className="flex-shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {isPaying
                                ? <Loader2 size={10} className="animate-spin" />
                                : 'Marcar pago'}
                            </button>
                          )}
                          {showUndo && obligation && (
                            <button
                              onClick={() => handleUnmarkObligationPaid(obligation.id)}
                              disabled={undoingIds.has(obligation.id)}
                              className="flex-shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {undoingIds.has(obligation.id)
                                ? <Loader2 size={10} className="animate-spin" />
                                : 'Desfazer'}
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
