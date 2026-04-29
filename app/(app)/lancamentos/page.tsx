'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Copy, Loader2, Pencil, Trash2 } from 'lucide-react';
import { addExpense, addExpenseInstallments, addRecurringExpense, deleteExpense, getExpenses } from '@/lib/storage';
import EditExpenseModal from '@/components/EditExpenseModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { ToastContainer, useToast } from '@/components/Toast';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  Category,
  EntryType,
  Expense,
} from '@/lib/types';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function LancamentosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Alimentação');
  const [date, setDate] = useState(todayStr);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [launchMode, setLaunchMode] = useState<'single' | 'installments' | 'recurring'>('single');
  const [installments, setInstallments] = useState(2);
  const [recurringDay, setRecurringDay] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    getExpenses().then(setExpenses);
  }, []);

  function handleTypeChange(type: EntryType) {
    setEntryType(type);
    setCategory(type === 'expense' ? 'Alimentação' : 'Salário');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || num <= 0 || !description.trim()) return;

    const base = { type: entryType, amount: num, description: description.trim(), category, date };

    setSaving(true);
    setError(null);
    try {
      if (launchMode === 'installments') {
        const saved = await addExpenseInstallments(base, installments);
        setExpenses((prev) => [...saved, ...prev]);
      } else if (launchMode === 'recurring') {
        const day = parseInt(recurringDay, 10);
        if (!day || day < 1 || day > 31) {
          setError('Informe um dia do mês válido (1–31).');
          setSaving(false);
          return;
        }
        const rec = await addRecurringExpense({
          description: base.description,
          amount: num,
          category,
          type: entryType,
          dayOfMonth: day,
          active: true,
        });
        const saved = await addExpense(base, rec.id);
        setExpenses((prev) => [saved, ...prev]);
      } else {
        const saved = await addExpense(base);
        setExpenses((prev) => [saved, ...prev]);
      }

      setAmount('');
      setDescription('');
      setDate(todayStr());
      setRecurringDay('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      addToast(
        launchMode === 'installments'
          ? `${installments} parcelas lançadas!`
          : launchMode === 'recurring'
          ? 'Lançamento recorrente criado!'
          : entryType === 'income'
          ? 'Receita registrada!'
          : 'Gasto lançado!',
        'success'
      );
      getExpenses().then(setExpenses);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await deleteExpense(id);
    addToast('Lançamento excluído', 'success');
  };

  const handleEditSave = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditingExpense(null);
    addToast('Lançamento atualizado', 'success');
  };

  const handleDuplicateSave = (saved: Expense) => {
    setExpenses((prev) => [saved, ...prev]);
    setDuplicatingExpense(null);
    addToast('Lançamento duplicado', 'success');
  };

  const categories = entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const currentMonth = getMonthKey(new Date());
  const currentExpenses = [...expenses]
    .filter((e) => e.date.slice(0, 7) === currentMonth)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Lançar</h1>
      <p className="text-slate-400 text-sm mb-5">Registre um gasto ou receita</p>

      <div className="md:grid md:grid-cols-[420px_1fr] md:gap-8 md:items-start">

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 md:mb-0 space-y-4">
        <div className="flex p-1 bg-slate-800 rounded-xl">
          <button type="button" onClick={() => handleTypeChange('expense')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${entryType === 'expense' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
            Gasto
          </button>
          <button type="button" onClick={() => handleTypeChange('income')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${entryType === 'income' ? 'bg-slate-900 text-green-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}>
            Receita
          </button>
        </div>

        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Valor (R$)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
            <input type="number" inputMode="decimal" step="0.01" min="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-lg font-semibold placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
        </div>

        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Descrição</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={entryType === 'expense' ? 'Ex: iFood, Supermercado...' : 'Ex: Salário maio, Projeto X...'}
            maxLength={80} required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
        </div>

        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors" />
        </div>

        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-2">Categoria</label>
          <div className={`grid gap-2 ${entryType === 'expense' ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {categories.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const active = category === cat;
              return (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                    active ? `${cfg.bgClass} ${cfg.borderClass} ${cfg.textClass}` : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}>
                  <span className="text-lg">{cfg.icon}</span>
                  <span className="text-[10px] leading-tight text-center">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

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

          {launchMode === 'installments' && (
            <div className="mt-3">
              <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Número de parcelas</label>
              <input type="number" inputMode="numeric" min={2} max={48} value={installments}
                onChange={(e) => setInstallments(Math.min(48, Math.max(2, parseInt(e.target.value) || 2)))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors" />
              <p className="text-slate-600 text-xs mt-1">
                {installments}x de {amount ? `R$ ${parseFloat(amount.replace(',','.')).toFixed(2)}` : 'R$ –'} · {installments} meses consecutivos
              </p>
            </div>
          )}

          {launchMode === 'recurring' && (
            <div className="mt-3">
              <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Dia do mês para lançar automaticamente</label>
              <input type="number" inputMode="numeric" min={1} max={31} value={recurringDay}
                onChange={(e) => setRecurringDay(e.target.value)} placeholder="Ex: 5"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
              <p className="text-slate-600 text-xs mt-1">Este lançamento será repetido todo mês nessa data</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={saving}
          className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${
            success ? 'bg-green-600' : entryType === 'income' ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95' : 'bg-violet-600 hover:bg-violet-500 active:scale-95'
          }`}>
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : success ? (
            <><CheckCircle size={18} />Salvo com sucesso!</>
          ) : launchMode === 'installments' ? (
            `Parcelar em ${installments}x`
          ) : launchMode === 'recurring' ? (
            'Lançar e tornar recorrente'
          ) : entryType === 'income' ? (
            'Registrar receita'
          ) : (
            'Lançar gasto'
          )}
        </button>
      </form>

      <div>
      <h2 className="text-slate-200 font-semibold text-sm mb-2">Este mês</h2>
      {currentExpenses.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">Nenhum lançamento este mês ainda</p>
      ) : (
        <div className="space-y-2">
          {currentExpenses.map((exp) => {
            const cfg = CATEGORY_CONFIG[exp.category];
            const day = exp.date.slice(8, 10);
            const month = exp.date.slice(5, 7);
            const isIncome = exp.type === 'income';
            return (
              <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
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
                <button onClick={() => setEditingExpense(exp)} className="text-slate-600 hover:text-violet-400 transition-colors flex-shrink-0 ml-1" aria-label="Editar">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setDuplicatingExpense(exp)} className="text-slate-600 hover:text-cyan-400 transition-colors flex-shrink-0" aria-label="Duplicar">
                  <Copy size={15} />
                </button>
                <button onClick={() => setDeletingExpense(exp)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0" aria-label="Excluir">
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

    {editingExpense && (
      <EditExpenseModal expense={editingExpense} onSave={handleEditSave} onClose={() => setEditingExpense(null)} />
    )}
    {duplicatingExpense && (
      <EditExpenseModal expense={duplicatingExpense} mode="duplicate" onSave={handleDuplicateSave} onClose={() => setDuplicatingExpense(null)} />
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
