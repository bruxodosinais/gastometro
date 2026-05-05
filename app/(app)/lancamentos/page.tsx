'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronDown, Copy, Loader2, MoreHorizontal, Pencil, Settings2, Trash2 } from 'lucide-react';
import {
  addExpense,
  addExpenseInstallments,
  addRecurringExpense,
  deleteExpense,
  getExpenses,
} from '@/lib/storage';
import EditExpenseModal from '@/components/EditExpenseModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import CategoryPickerSheet from '@/components/CategoryPickerSheet';
import { ToastContainer, useToast } from '@/components/Toast';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { Category, EntryType, Expense, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/types';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS_LONG = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  if (dateStr === todayStr()) return `Hoje, ${day} de ${MONTHS_LONG[d.getMonth()]}`;
  if (dateStr === yesterdayStr()) return `Ontem, ${day} de ${MONTHS_LONG[d.getMonth()]}`;
  return `${String(day).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatGroupLabel(dateStr: string): string {
  const day = dateStr.slice(8, 10);
  const month = dateStr.slice(5, 7);
  const ddmm = `${day}/${month}`;
  if (dateStr === todayStr()) return `Hoje · ${ddmm}`;
  if (dateStr === yesterdayStr()) return `Ontem · ${ddmm}`;
  const d = new Date(dateStr + 'T12:00:00');
  return `${ddmm} · ${WEEKDAYS[d.getDay()]}`;
}

function groupByDate(expenses: Expense[]) {
  const map = new Map<string, Expense[]>();
  for (const exp of expenses) {
    if (!map.has(exp.date)) map.set(exp.date, []);
    map.get(exp.date)!.push(exp);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, label: formatGroupLabel(date), items }));
}

function ExpenseList({
  expenses,
  newestId,
  flashId,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  expenses: Expense[];
  newestId: string | null;
  flashId: string | null;
  onEdit: (e: Expense) => void;
  onDuplicate: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    function close() { setOpenMenuId(null); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  if (expenses.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-6">Nenhum lançamento este mês ainda</p>;
  }

  const groups = groupByDate(expenses);

  return (
    <div className="space-y-4">
      {groups.map(({ date, label, items }) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-400">{label}</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="space-y-2">
            {items.map((exp) => {
              const cfg = CATEGORY_CONFIG[exp.category];
              const isIncome = exp.type === 'income';
              const isNewest = exp.id === newestId;
              const isFlashing = exp.id === flashId;
              const isMenuOpen = openMenuId === exp.id;
              return (
                <div
                  key={exp.id}
                  className={`border border-[#F3F4F6] rounded-xl px-4 py-3 flex items-center gap-3 transition-colors duration-500 ${
                    isFlashing ? 'bg-gray-100/60' : 'bg-white'
                  } ${isNewest ? 'animate-in fade-in slide-in-from-bottom-3 duration-[180ms] ease-out' : ''}`}
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">{exp.description}</p>
                    <p className="text-gray-500 text-xs">{exp.category}</p>
                  </div>
                  <span className="font-semibold text-sm whitespace-nowrap" style={{ color: isIncome ? '#10B981' : '#EF4444' }}>
                    {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
                  </span>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : exp.id); }}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                      aria-label="Mais opções"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {isMenuOpen && (
                      <div className="absolute right-0 top-8 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[130px]">
                        <button
                          onClick={() => { onEdit(exp); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          onClick={() => { onDuplicate(exp); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Copy size={12} /> Duplicar
                        </button>
                        <button
                          onClick={() => { onDelete(exp); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={12} /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LancamentosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Alimentação');
  const [date, setDate] = useState(todayStr);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [launchMode, setLaunchMode] = useState<'single' | 'installments' | 'recurring'>('single');
  const [installments, setInstallments] = useState(2);
  const [recurringDay, setRecurringDay] = useState('');

  const [inputScale, setInputScale] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [valueOpacity, setValueOpacity] = useState(1);
  const [topToast, setTopToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [newestId, setNewestId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    getExpenses().then(setExpenses);
    amountRef.current?.focus();
  }, []);

  useEffect(() => {
    if (showDatePicker) dateInputRef.current?.focus();
  }, [showDatePicker]);

  function showTopToastMsg(msg: string) {
    setTopToast(msg);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 10);
    setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setTopToast(null), 150);
    }, 2510);
  }

  function handleTypeChange(type: EntryType) {
    setEntryType(type);
    setCategory(type === 'expense' ? 'Alimentação' : 'Salário');
    setShowCategoryPicker(false);
  }

  const numAmount = parseFloat(amount.replace(',', '.'));
  const hasAmount = numAmount > 0;
  const isValid = hasAmount && !!category;

  async function handleSubmit() {
    if (!isValid || saving) return;
    const savedAmount = numAmount;
    const savedType = entryType;
    const base = {
      type: entryType,
      amount: numAmount,
      description: description.trim() || category,
      category,
      date,
    };
    setSaving(true);
    setError(null);
    try {
      let newId: string | null = null;
      if (launchMode === 'installments') {
        const saved = await addExpenseInstallments(base, installments);
        setExpenses((prev) => [...saved, ...prev]);
        newId = saved[0]?.id ?? null;
      } else if (launchMode === 'recurring') {
        const day = parseInt(recurringDay, 10);
        if (!day || day < 1 || day > 31) {
          setError('Informe um dia do mês válido (1–31).');
          setSaving(false);
          return;
        }
        const rec = await addRecurringExpense({
          description: base.description,
          amount: numAmount,
          category,
          type: entryType,
          dayOfMonth: day,
          active: true,
        });
        const saved = await addExpense(base, rec.id);
        setExpenses((prev) => [saved, ...prev]);
        newId = saved.id;
      } else {
        const saved = await addExpense(base);
        setExpenses((prev) => [saved, ...prev]);
        newId = saved.id;
      }

      if (newId) {
        setNewestId(newId);
        setFlashId(newId);
        setTimeout(() => setFlashId(null), 500);
        setTimeout(() => setNewestId(null), 400);
      }

      setTimeout(() => {
        setValueOpacity(0);
        setTimeout(() => {
          setAmount('');
          setDescription('');
          setDate(todayStr());
          setRecurringDay('');
          setValueOpacity(1);
          amountRef.current?.focus();
        }, 150);
      }, 100);

      showTopToastMsg(
        savedType === 'income'
          ? `Receita de ${formatCurrency(savedAmount)} registrada`
          : `Gasto de ${formatCurrency(savedAmount)} registrado`
      );
      getExpenses().then(setExpenses);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await deleteExpense(id);
    addToast('Lançamento excluído', 'success');
  }

  const categories = entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const currentMonth = getMonthKey(new Date());
  const currentExpenses = [...expenses]
    .filter((e) => e.date.slice(0, 7) === currentMonth)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const ctaLabel = saving ? null
    : launchMode === 'installments' ? `Parcelar em ${installments}x`
    : launchMode === 'recurring' ? 'Lançar e tornar recorrente'
    : entryType === 'income' ? 'Lançar receita'
    : 'Lançar gasto';

  const ctaBg = entryType === 'income' ? '#10B981' : '#EF4444';

  const glowColor = entryType === 'expense'
    ? 'drop-shadow(0 0 12px rgba(248, 113, 113, 0.3))'
    : 'drop-shadow(0 0 12px rgba(74, 222, 128, 0.3))';

  const valueColor = hasAmount
    ? entryType === 'expense' ? 'text-red-400' : 'text-mint-500'
    : 'text-gray-900';

  const prefixColor = hasAmount
    ? entryType === 'expense' ? 'text-red-400/50' : 'text-mint-500/50'
    : 'text-gray-500';

  return (
    <>
      <div className="fixed inset-0 bg-[#F9FAFB] -z-10 pointer-events-none" />
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-36 md:pb-8">
        <div className="md:grid md:grid-cols-[420px_1fr] md:gap-8 md:items-start">

          {/* FORM COLUMN */}
          <div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 md:mb-0 space-y-4">

              {/* 1. TOGGLE */}
              <div className="flex p-1 rounded-[10px] h-11" style={{ backgroundColor: '#F3F4F6' }}>
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`flex-1 rounded-[8px] text-sm font-semibold transition-all duration-200 ease-in-out ${
                    entryType === 'expense' ? 'text-white' : 'bg-transparent text-[#6B7280]'
                  }`}
                  style={entryType === 'expense' ? { backgroundColor: '#EF4444', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' } : {}}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`flex-1 rounded-[8px] text-sm font-semibold transition-all duration-200 ease-in-out ${
                    entryType === 'income' ? 'text-white' : 'bg-transparent text-[#6B7280]'
                  }`}
                  style={entryType === 'income' ? { backgroundColor: '#10B981', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' } : {}}
                >
                  Receita
                </button>
              </div>

              {/* 2. VALUE DISPLAY */}
              <div
                className="flex items-center justify-center gap-2 py-2"
                style={{ filter: inputFocused ? glowColor : 'none', transition: 'filter 200ms ease' }}
              >
                <span className={`text-3xl font-semibold select-none transition-colors duration-200 ${prefixColor}`}>
                  R$
                </span>
                <div className="relative w-48">
                  <input
                    ref={amountRef}
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
                    className={`text-6xl font-bold bg-transparent border-none outline-none text-center w-full pb-1 placeholder:text-slate-700 transition-colors duration-200 ${valueColor}`}
                    style={{
                      transform: inputScale ? 'scale(1.02)' : 'scale(1)',
                      opacity: valueOpacity,
                      transition: 'transform 100ms ease-out, opacity 150ms ease, color 200ms ease',
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

              {/* 3. CATEGORY */}
              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1.5">Categoria</label>
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

              {/* 4. DESCRIPTION */}
              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1.5">Descrição</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={entryType === 'expense' ? 'Ex: iFood, Supermercado...' : 'Ex: Salário maio, Projeto X...'}
                  maxLength={80}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#7C3AED] transition-colors"
                />
              </div>

              {/* 5. DATE */}
              <div>
                <label className="text-gray-500 text-xs font-medium block mb-1.5">Data</label>
                {showDatePicker ? (
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setShowDatePicker(false); }}
                    onBlur={() => setShowDatePicker(false)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(true)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 flex items-center gap-2.5 text-left transition-colors hover:border-[#7C3AED]"
                  >
                    <CalendarDays size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-900">{formatDateDisplay(date)}</span>
                  </button>
                )}
              </div>

              {/* 6. MAIS OPÇÕES */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMoreOptions((v) => !v)}
                  className="flex items-center gap-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors"
                >
                  <Settings2 size={14} />
                  Mais opções
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showMoreOptions ? 'rotate-180' : ''}`} />
                </button>

                {showMoreOptions && (
                  <div className="mt-3 space-y-4">
                    <div>
                      <label className="text-gray-500 text-xs font-medium block mb-2">Tipo de lançamento</label>
                      <div className="flex gap-2">
                        {(['single', 'recurring', 'installments'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setLaunchMode(mode)}
                            className="flex-1 py-2 px-3 rounded-[8px] text-xs font-semibold transition-all duration-200"
                            style={
                              launchMode === mode
                                ? { backgroundColor: '#7C3AED', color: '#FFFFFF' }
                                : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                            }
                          >
                            {mode === 'single' ? 'Único' : mode === 'installments' ? 'Parcelado' : 'Recorrente'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {launchMode === 'installments' && (
                      <div>
                        <label className="text-gray-500 text-xs font-medium block mb-1.5">Número de parcelas</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={2}
                          max={48}
                          value={installments}
                          onChange={(e) => setInstallments(Math.min(48, Math.max(2, parseInt(e.target.value) || 2)))}
                          className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                          {installments}x de {amount ? `R$ ${parseFloat(amount.replace(',', '.')).toFixed(2)}` : 'R$ –'} · {installments} meses consecutivos
                        </p>
                      </div>
                    )}

                    {launchMode === 'recurring' && (
                      <div>
                        <label className="text-gray-500 text-xs font-medium block mb-1.5">Dia do mês para lançar automaticamente</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={31}
                          value={recurringDay}
                          onChange={(e) => setRecurringDay(e.target.value)}
                          placeholder="Ex: 5"
                          className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-gray-900 text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#7C3AED] transition-colors"
                        />
                        <p className="text-gray-500 text-xs mt-1">Este lançamento será repetido todo mês nessa data</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* CTA — desktop */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || saving}
                className="hidden md:flex w-full h-[52px] rounded-xl font-semibold text-white transition-all items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: isValid ? ctaBg : '#D1D5DB' }}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : ctaLabel}
              </button>

            </div>
          </div>

          {/* LIST COLUMN — desktop */}
          <div
            className="hidden md:block"
            style={{ opacity: hasAmount ? 0.58 : 1, transition: 'opacity 300ms ease' }}
          >
            <h2 className="text-gray-800 font-semibold text-sm mb-3">Este mês</h2>
            <ExpenseList
              expenses={currentExpenses}
              newestId={newestId}
              flashId={flashId}
              onEdit={setEditingExpense}
              onDuplicate={setDuplicatingExpense}
              onDelete={setDeletingExpense}
            />
          </div>
        </div>

        {/* LIST — mobile */}
        <div
          className="md:hidden mt-6"
          style={{ opacity: hasAmount ? 0.58 : 1, transition: 'opacity 300ms ease' }}
        >
          <h2 className="text-gray-800 font-semibold text-sm mb-3">Este mês</h2>
          <ExpenseList
            expenses={currentExpenses}
            newestId={newestId}
            flashId={flashId}
            onEdit={setEditingExpense}
            onDuplicate={setDuplicatingExpense}
            onDelete={setDeletingExpense}
          />
        </div>
      </main>

      {/* CTA — mobile fixed above nav */}
      <div className="fixed bottom-[72px] left-0 right-0 px-4 z-40 md:hidden">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="w-full h-[52px] rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: isValid ? ctaBg : '#D1D5DB' }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : ctaLabel}
        </button>
      </div>

      {topToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm pointer-events-none">
          <div
            className="bg-gray-50 border border-green-500/40 text-gray-900 text-sm font-medium px-4 py-3 rounded-xl shadow-lg text-center"
            style={{
              opacity: toastVisible ? 1 : 0,
              transform: toastVisible ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.98)',
              transition: toastVisible
                ? 'opacity 200ms ease-out, transform 200ms ease-out'
                : 'opacity 150ms ease',
            }}
          >
            {topToast}
          </div>
        </div>
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onSave={(updated) => {
            setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            setEditingExpense(null);
            addToast('Lançamento atualizado', 'success');
          }}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {duplicatingExpense && (
        <EditExpenseModal
          expense={duplicatingExpense}
          mode="duplicate"
          onSave={(saved) => {
            setExpenses((prev) => [saved, ...prev]);
            setDuplicatingExpense(null);
            addToast('Lançamento duplicado', 'success');
          }}
          onClose={() => setDuplicatingExpense(null)}
        />
      )}
      {deletingExpense && (
        <ConfirmDeleteModal
          title="Excluir lançamento"
          description={`"${deletingExpense.description}" será removido permanentemente.`}
          onConfirm={() => handleDelete(deletingExpense.id)}
          onClose={() => setDeletingExpense(null)}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <CategoryPickerSheet
        open={showCategoryPicker}
        categories={categories}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
        columns={4}
      />
    </>
  );
}
