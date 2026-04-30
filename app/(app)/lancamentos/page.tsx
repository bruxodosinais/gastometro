'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronDown, Copy, Loader2, Pencil, Settings2, Trash2 } from 'lucide-react';
import {
  addExpense,
  addExpenseInstallments,
  addRecurringExpense,
  deleteExpense,
  getExpenses,
} from '@/lib/storage';
import EditExpenseModal from '@/components/EditExpenseModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { ToastContainer, useToast } from '@/components/Toast';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { Category, EntryType, Expense, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/types';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  const d = new Date(dateStr + 'T12:00:00');
  const months = [
    'janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro',
  ];
  const dayLabel = `${d.getDate()} de ${months[d.getMonth()]}`;
  if (dateStr === today) return `Hoje, ${dayLabel}`;
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
  if (dateStr === yStr) return `Ontem, ${dayLabel}`;
  return dayLabel;
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
  if (expenses.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-6">Nenhum lançamento este mês ainda</p>;
  }
  return (
    <div className="space-y-2">
      {expenses.map((exp) => {
        const cfg = CATEGORY_CONFIG[exp.category];
        const day = exp.date.slice(8, 10);
        const month = exp.date.slice(5, 7);
        const isIncome = exp.type === 'income';
        const isNewest = exp.id === newestId;
        const isFlashing = exp.id === flashId;
        return (
          <div
            key={exp.id}
            className={`border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors duration-500 ${
              isFlashing ? 'bg-slate-700/60' : 'bg-slate-900'
            } ${isNewest ? 'animate-in fade-in slide-in-from-bottom-3 duration-[180ms] ease-out' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}>
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{exp.description}</p>
              <p className="text-slate-500 text-xs">{exp.category} · {day}/{month}</p>
            </div>
            <span className={`font-semibold text-sm whitespace-nowrap ${isIncome ? 'text-green-400' : 'text-white'}`}>
              {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
            </span>
            <button onClick={() => onEdit(exp)} className="text-slate-600 hover:text-violet-400 transition-colors flex-shrink-0 ml-1" aria-label="Editar">
              <Pencil size={15} />
            </button>
            <button onClick={() => onDuplicate(exp)} className="text-slate-600 hover:text-cyan-400 transition-colors flex-shrink-0" aria-label="Duplicar">
              <Copy size={15} />
            </button>
            <button onClick={() => onDelete(exp)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0" aria-label="Excluir">
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function LancamentosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Alimentação');
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Secondary fields — collapsed by default
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [launchMode, setLaunchMode] = useState<'single' | 'installments' | 'recurring'>('single');
  const [installments, setInstallments] = useState(2);
  const [recurringDay, setRecurringDay] = useState('');

  // Polish states
  const [inputScale, setInputScale] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [valueOpacity, setValueOpacity] = useState(1);
  const [topToast, setTopToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [newestId, setNewestId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // Modals
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    getExpenses().then(setExpenses);
    amountRef.current?.focus();
  }, []);

  useEffect(() => {
    if (showDescription) descRef.current?.focus();
  }, [showDescription]);

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

      // Animate newest item
      if (newId) {
        setNewestId(newId);
        setFlashId(newId);
        setTimeout(() => setFlashId(null), 500);
        setTimeout(() => setNewestId(null), 400);
      }

      // 100ms delay before fade-out reset
      setTimeout(() => {
        setValueOpacity(0);
        setTimeout(() => {
          setAmount('');
          setDescription('');
          setShowDescription(false);
          setDate(todayStr());
          setRecurringDay('');
          setValueOpacity(1);
          amountRef.current?.focus();
        }, 150);
      }, 100);

      const formatted = formatCurrency(savedAmount);
      showTopToastMsg(
        savedType === 'income'
          ? `Receita de ${formatted} registrada`
          : `Gasto de ${formatted} registrado`
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
    : entryType === 'income'
    ? (hasAmount ? `Registrar ${formatCurrency(numAmount)}` : 'Registrar receita')
    : (hasAmount ? `Lançar ${formatCurrency(numAmount)}` : 'Lançar gasto');

  const ctaBase = 'w-full py-3 rounded-2xl font-semibold text-white text-base transition-all flex items-center justify-center gap-2';
  const ctaActive = entryType === 'income'
    ? 'bg-green-600 hover:bg-green-500'
    : 'bg-violet-600 hover:bg-violet-500';
  const ctaDisabled = 'bg-slate-700 opacity-50 cursor-default';
  const ctaColor = isValid ? ctaActive : ctaDisabled;

  // Pressing animation style
  const pressingStyle: React.CSSProperties = {
    transform: pressing ? 'scale(0.96)' : 'scale(1)',
    transition: pressing
      ? 'transform 50ms ease-in'
      : 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const glowColor = entryType === 'expense'
    ? 'drop-shadow(0 0 12px rgba(248, 113, 113, 0.3))'
    : 'drop-shadow(0 0 12px rgba(74, 222, 128, 0.3))';

  const valueColor = hasAmount
    ? entryType === 'expense' ? 'text-red-400' : 'text-green-400'
    : 'text-white';

  const prefixColor = hasAmount
    ? entryType === 'expense' ? 'text-red-400/50' : 'text-green-400/50'
    : 'text-slate-500';

  return (
    <>
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-36 md:pb-8">
        <div className="md:grid md:grid-cols-[420px_1fr] md:gap-8 md:items-start">

          {/* ── FORM COLUMN ──────────────────────────────────────────────── */}
          <div>
            {/* 1. VALUE */}
            <div
              className="flex items-center justify-center gap-2 mb-6"
              style={{
                filter: inputFocused ? glowColor : 'none',
                transition: 'filter 200ms ease',
              }}
            >
              <span className={`text-3xl font-semibold select-none transition-colors duration-200 ${prefixColor}`}>
                R$
              </span>
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
                className={`text-6xl font-bold bg-transparent border-none outline-none text-center w-48 placeholder:text-slate-700 transition-colors duration-200 ${valueColor}`}
                style={{
                  transform: inputScale ? 'scale(1.02)' : 'scale(1)',
                  opacity: valueOpacity,
                  transition: 'transform 100ms ease-out, opacity 150ms ease, color 200ms ease',
                  caretColor: entryType === 'expense' ? '#f87171' : '#4ade80',
                }}
              />
            </div>

            {/* 2. TOGGLE */}
            <div className="flex gap-2 justify-center mb-6">
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  entryType === 'expense'
                    ? 'bg-red-500/15 border border-red-500/40 text-red-400'
                    : 'border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  entryType === 'income'
                    ? 'bg-green-500/20 border border-green-500/60 text-green-400'
                    : 'border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                Receita
              </button>
            </div>

            {/* 3. CATEGORIES */}
            <div className="grid grid-cols-4 gap-2 mb-6">
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
                        ? 'bg-violet-500/15 border-violet-500/50 text-violet-300'
                        : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <span className="text-xl leading-none">{cfg.icon}</span>
                    <span className="text-[10px] leading-tight text-center">{cat}</span>
                  </button>
                );
              })}
            </div>

            {/* 4. SECONDARY FIELDS */}
            <div className="space-y-3 mb-4">
              {/* Description */}
              {!showDescription ? (
                <button
                  type="button"
                  onClick={() => setShowDescription(true)}
                  className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
                >
                  + Adicionar descrição (opcional)
                </button>
              ) : (
                <input
                  ref={descRef}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={entryType === 'expense' ? 'Ex: iFood, Supermercado...' : 'Ex: Salário maio, Projeto X...'}
                  maxLength={80}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              )}

              {/* Date */}
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} className="text-slate-600 flex-shrink-0" />
                {!showDatePicker ? (
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(true)}
                    className="flex items-center gap-1 text-slate-500 text-sm hover:text-slate-300 transition-colors"
                  >
                    {formatDateLabel(date)}
                    <Pencil size={11} className="text-slate-600" />
                  </button>
                ) : (
                  <input
                    type="date"
                    value={date}
                    autoFocus
                    onChange={(e) => { setDate(e.target.value); setShowDatePicker(false); }}
                    onBlur={() => setShowDatePicker(false)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                )}
              </div>

              {/* More options */}
              <button
                type="button"
                onClick={() => setShowMoreOptions((v) => !v)}
                className="flex items-center gap-1.5 text-slate-500 text-sm hover:text-slate-300 transition-colors"
              >
                <Settings2 size={14} />
                Mais opções
                <ChevronDown size={14} className={`transition-transform duration-200 ${showMoreOptions ? 'rotate-180' : ''}`} />
              </button>

              {showMoreOptions && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div>
                    <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-2">Tipo de lançamento</label>
                    <div className="flex p-0.5 bg-slate-800 rounded-xl">
                      {(['single', 'installments', 'recurring'] as const).map((mode) => (
                        <button key={mode} type="button" onClick={() => setLaunchMode(mode)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${launchMode === mode ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                          {mode === 'single' ? 'Único' : mode === 'installments' ? 'Parcelado' : 'Recorrente'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {launchMode === 'installments' && (
                    <div>
                      <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Número de parcelas</label>
                      <input
                        type="number" inputMode="numeric" min={2} max={48} value={installments}
                        onChange={(e) => setInstallments(Math.min(48, Math.max(2, parseInt(e.target.value) || 2)))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                      />
                      <p className="text-slate-600 text-xs mt-1">
                        {installments}x de {amount ? `R$ ${parseFloat(amount.replace(',', '.')).toFixed(2)}` : 'R$ –'} · {installments} meses consecutivos
                      </p>
                    </div>
                  )}

                  {launchMode === 'recurring' && (
                    <div>
                      <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Dia do mês para lançar automaticamente</label>
                      <input
                        type="number" inputMode="numeric" min={1} max={31} value={recurringDay}
                        onChange={(e) => setRecurringDay(e.target.value)} placeholder="Ex: 5"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                      <p className="text-slate-600 text-xs mt-1">Este lançamento será repetido todo mês nessa data</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* CTA — desktop only (inside column) */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || saving}
              onPointerDown={() => { if (isValid) setPressing(true); }}
              onPointerUp={() => setPressing(false)}
              onPointerLeave={() => setPressing(false)}
              className={`hidden md:flex ${ctaBase} ${ctaColor}`}
              style={pressingStyle}
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : ctaLabel}
            </button>
          </div>

          {/* ── LIST COLUMN (desktop) ─────────────────────────────────────── */}
          <div
            className="hidden md:block"
            style={{ opacity: hasAmount ? 0.58 : 1, transition: 'opacity 300ms ease' }}
          >
            <h2 className="text-slate-200 font-semibold text-sm mb-2">Este mês</h2>
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

        {/* LIST — mobile (below form) */}
        <div
          className="md:hidden mt-6"
          style={{ opacity: hasAmount ? 0.58 : 1, transition: 'opacity 300ms ease' }}
        >
          <h2 className="text-slate-200 font-semibold text-sm mb-2">Este mês</h2>
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
          onPointerDown={() => { if (isValid) setPressing(true); }}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          className={`${ctaBase} ${ctaColor}`}
          style={pressingStyle}
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : ctaLabel}
        </button>
      </div>

      {/* Top toast — confirmation after save */}
      {topToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm pointer-events-none">
          <div
            className="bg-slate-800 border border-green-500/40 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg text-center"
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
    </>
  );
}
