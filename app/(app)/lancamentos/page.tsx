'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { addExpense, deleteExpense, getExpenses } from '@/lib/storage';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { CATEGORIES, Category, Expense } from '@/lib/types';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function LancamentosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Alimentação');
  const [date, setDate] = useState(todayStr);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getExpenses().then(setExpenses);
  }, []);

  const reload = async () => setExpenses(await getExpenses());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || num <= 0 || !description.trim()) return;

    setSaving(true);
    try {
      await addExpense({ amount: num, description: description.trim(), category, date });
      setAmount('');
      setDescription('');
      setDate(todayStr());
      setSuccess(true);
      await reload();
      setTimeout(() => setSuccess(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    await reload();
  };

  const currentMonth = getMonthKey(new Date());
  const currentExpenses = [...expenses]
    .filter((e) => e.date.slice(0, 7) === currentMonth)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Lançar Gasto</h1>
      <p className="text-slate-400 text-sm mb-6">Registre uma nova despesa</p>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 space-y-4">
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
            placeholder="Ex: iFood - Jantar, Supermercado..."
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
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => {
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

        {/* Botão */}
        <button
          type="submit"
          disabled={saving}
          className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${
            success
              ? 'bg-green-600'
              : 'bg-violet-600 hover:bg-violet-500 active:scale-95'
          }`}
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : success ? (
            <>
              <CheckCircle size={18} />
              Salvo com sucesso!
            </>
          ) : (
            'Lançar gasto'
          )}
        </button>
      </form>

      {/* Lista do mês atual */}
      <h2 className="text-slate-200 font-semibold text-sm mb-2">Este mês</h2>
      {currentExpenses.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">
          Nenhum lançamento este mês ainda
        </p>
      ) : (
        <div className="space-y-2">
          {currentExpenses.map((exp) => {
            const cfg = CATEGORY_CONFIG[exp.category];
            const day = exp.date.slice(8, 10);
            const month = exp.date.slice(5, 7);
            return (
              <div
                key={exp.id}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}
                >
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{exp.description}</p>
                  <p className="text-slate-500 text-xs">
                    {exp.category} · {day}/{month}
                  </p>
                </div>
                <span className="text-white font-semibold text-sm whitespace-nowrap mr-2">
                  {formatCurrency(exp.amount)}
                </span>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
