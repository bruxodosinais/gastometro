'use client';

import { useEffect, useState } from 'react';
import { Copy, Pencil, Search, Trash2, X } from 'lucide-react';
import { deleteExpense, getExpenses } from '@/lib/storage';
import EditExpenseModal from '@/components/EditExpenseModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { ToastContainer, useToast } from '@/components/Toast';
import {
  calculateTotalByType,
  formatCurrency,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import {
  Category,
  EntryType,
  EXPENSE_CATEGORIES,
  Expense,
  INCOME_CATEGORIES,
} from '@/lib/types';

export default function HistoricoPage() {
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | EntryType>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const { toasts, addToast, removeToast } = useToast();

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

  const handleDelete = async (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await deleteExpense(id);
    addToast('Lançamento excluído', 'success');
  };

  useEffect(() => {
    getExpenses().then((data) => {
      setExpenses(data);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const refresh = () => getExpenses().then(setExpenses);
    window.addEventListener('focus', refresh);
    window.addEventListener('gastometro_expense_added', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('gastometro_expense_added', refresh);
    };
  }, []);

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const periodEntries = [...expenses]
    .filter((e) => e.date.slice(0, 7) === period)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const income = calculateTotalByType(periodEntries, 'income');
  const spent = calculateTotalByType(periodEntries, 'expense');
  const balance = income - spent;

  const categoryOptions: Category[] =
    typeFilter === 'expense'
      ? EXPENSE_CATEGORIES
      : typeFilter === 'income'
      ? INCOME_CATEGORIES
      : ([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES.filter((c) => !EXPENSE_CATEGORIES.includes(c as never))] as Category[]);

  function handleTypeFilterChange(type: 'all' | EntryType) {
    setTypeFilter(type);
    if (type === 'expense' && INCOME_CATEGORIES.includes(categoryFilter as never)) setCategoryFilter('all');
    if (type === 'income' && EXPENSE_CATEGORIES.includes(categoryFilter as never)) setCategoryFilter('all');
  }

  const today = new Date().toISOString().slice(0, 10);
  const needle = search.trim().toLowerCase();
  const filteredEntries = periodEntries
    .filter((e) => typeFilter === 'all' || e.type === typeFilter)
    .filter((e) => categoryFilter === 'all' || e.category === categoryFilter)
    .filter((e) => !needle || e.description.toLowerCase().includes(needle));

  return (
    <>
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Histórico</h1>
      <p className="text-slate-400 text-sm mb-5 capitalize">{getMonthLabel(period)}</p>

      <PeriodSelector />

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Ganhos</p>
          <p className="text-green-400 font-bold text-sm">{formatCurrency(income)}</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Gastos</p>
          <p className="text-red-400 font-bold text-sm">{formatCurrency(spent)}</p>
        </div>
        <div className={`rounded-xl p-3 border ${balance >= 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Saldo</p>
          <p className={`font-bold text-sm ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))}
          </p>
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descrição..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            aria-label="Limpar busca"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        <div className="flex p-0.5 bg-slate-900 border border-slate-800 rounded-xl flex-1 min-w-0">
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTypeFilterChange(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === t ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'expense' ? 'Gastos' : 'Receitas'}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as Category | 'all')}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors shrink-0"
        >
          <option value="all">Todas</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {periodEntries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Nenhum lançamento neste período</p>
      ) : filteredEntries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Nenhum resultado para os filtros aplicados</p>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((exp) => {
            const cfg = CATEGORY_CONFIG[exp.category];
            const day = exp.date.slice(8, 10);
            const month = exp.date.slice(5, 7);
            const isIncome = exp.type === 'income';
            const isFuture = exp.date > today;
            return (
              <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{exp.description}</p>
                  <p className="text-slate-500 text-xs">{exp.category} · {day}/{month}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`font-semibold text-sm whitespace-nowrap ${isFuture ? 'text-slate-400' : isIncome ? 'text-green-400' : 'text-white'}`}>
                    {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
                  </span>
                  {isFuture && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                      futuro
                    </span>
                  )}
                </div>
                <button onClick={() => setEditingExpense(exp)} className="text-slate-600 hover:text-violet-400 transition-colors flex-shrink-0 ml-2" aria-label="Editar">
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
