'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Plus, Pencil, Trash2, X, Check, Loader2,
  Wallet, BarChart2, Home, Briefcase, AlertCircle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  getAssets, createAsset, updateAsset, deleteAsset,
  getLiabilities, createLiability, updateLiability, deleteLiability,
  getExpenses,
} from '@/lib/storage';
import { formatCurrency, calculateTotalByType } from '@/lib/calculations';
import { Asset, AssetType, Expense, Liability } from '@/lib/types';

// ─── Configurações de bolso ──────────────────────────────────────────────────

type BolsoKey = AssetType;

const BOLSOS: Record<BolsoKey, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  caixa: {
    label: 'Caixa',
    icon: <Wallet size={20} />,
    color: 'text-mint-500',
    bg: 'bg-mint-50',
    border: 'border-emerald-500/20',
  },
  investimentos: {
    label: 'Investimentos',
    icon: <BarChart2 size={20} />,
    color: 'text-mint-500',
    bg: 'bg-mint-50',
    border: 'border-mint-500/20',
  },
  imoveis: {
    label: 'Imóveis',
    icon: <Home size={20} />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  negocios: {
    label: 'Negócios',
    icon: <Briefcase size={20} />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
};

const BOLSO_EMOJIS: Record<BolsoKey, string> = {
  caixa: '💵',
  investimentos: '📈',
  imoveis: '🏠',
  negocios: '💼',
};

const LIABILITY_TYPES = ['Empréstimo', 'Financiamento', 'Cartão', 'Outros'];

// ─── Tooltip customizado ─────────────────────────────────────────────────────

type TooltipPayload = { value: number; color: string };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="font-semibold text-mint-500">{formatCurrency(value)}</p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1);
  return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function getLast12MonthKeys(currentMonth: string): string[] {
  const [y, m] = currentMonth.split('-').map(Number);
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// ─── Formulário modal ─────────────────────────────────────────────────────────

type FormMode = 'asset' | 'liability';

interface FormState {
  name: string;
  type: string;
  value: string;
}

const EMPTY_FORM: FormState = { name: '', type: '', value: '' };

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PatrimonioPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);

  const [modalMode, setModalMode] = useState<FormMode | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAssets(), getLiabilities(), getExpenses()]).then(([a, l, e]) => {
      setAssets(a);
      setLiabilities(l);
      setExpenses(e);
      setReady(true);
    });
  }, []);

  // ── Derivadas ────────────────────────────────────────────────────────────────

  const totalAssets = useMemo(() => assets.reduce((s, a) => s + a.value, 0), [assets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((s, l) => s + l.value, 0), [liabilities]);
  const netWorth = totalAssets - totalLiabilities;

  const bolsoTotals = useMemo(() => {
    const totals: Record<BolsoKey, number> = { caixa: 0, investimentos: 0, imoveis: 0, negocios: 0 };
    for (const a of assets) totals[a.type] += a.value;
    return totals;
  }, [assets]);

  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const monthlyChart = useMemo(() => {
    const months = getLast12MonthKeys(currentMonthKey);
    return months.map((key) => {
      const monthExpenses = expenses.filter((e) => e.date.slice(0, 7) === key);
      const income = calculateTotalByType(monthExpenses, 'income');
      const spent = calculateTotalByType(monthExpenses, 'expense');
      return {
        month: shortMonthLabel(key),
        saldo: income - spent,
      };
    });
  }, [expenses, currentMonthKey]);

  const currentMonthExpenses = useMemo(
    () => expenses.filter((e) => e.date.slice(0, 7) === currentMonthKey),
    [expenses, currentMonthKey]
  );

  const prevMonthKey = (() => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const prevMonthExpenses = useMemo(
    () => expenses.filter((e) => e.date.slice(0, 7) === prevMonthKey),
    [expenses, prevMonthKey]
  );

  const currentBalance = calculateTotalByType(currentMonthExpenses, 'income') - calculateTotalByType(currentMonthExpenses, 'expense');
  const prevBalance = calculateTotalByType(prevMonthExpenses, 'income') - calculateTotalByType(prevMonthExpenses, 'expense');
  const balanceDiff = currentBalance - prevBalance;

  // ── Formulário ───────────────────────────────────────────────────────────────

  function openAddAsset() {
    setEditingAsset(null);
    setEditingLiability(null);
    setForm({ ...EMPTY_FORM, type: 'caixa' });
    setFormError(null);
    setModalMode('asset');
  }

  function openEditAsset(a: Asset) {
    setEditingLiability(null);
    setEditingAsset(a);
    setForm({ name: a.name, type: a.type, value: String(a.value) });
    setFormError(null);
    setModalMode('asset');
  }

  function openAddLiability() {
    setEditingAsset(null);
    setEditingLiability(null);
    setForm({ ...EMPTY_FORM, type: LIABILITY_TYPES[0] });
    setFormError(null);
    setModalMode('liability');
  }

  function openEditLiability(l: Liability) {
    setEditingAsset(null);
    setEditingLiability(l);
    setForm({ name: l.name, type: l.type, value: String(l.value) });
    setFormError(null);
    setModalMode('liability');
  }

  function closeModal() {
    setModalMode(null);
    setEditingAsset(null);
    setEditingLiability(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSave() {
    setFormError(null);
    const value = parseFloat(form.value.replace(',', '.'));
    if (!form.name.trim()) { setFormError('Informe um nome.'); return; }
    if (!form.type) { setFormError('Selecione o tipo.'); return; }
    if (!value || value <= 0) { setFormError('O valor deve ser maior que zero.'); return; }

    setSaving(true);
    try {
      if (modalMode === 'asset') {
        if (editingAsset) {
          const updated = await updateAsset(editingAsset.id, { name: form.name.trim(), type: form.type as AssetType, value });
          setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        } else {
          const created = await createAsset({ name: form.name.trim(), type: form.type as AssetType, value });
          setAssets((prev) => [...prev, created]);
        }
      } else {
        if (editingLiability) {
          const updated = await updateLiability(editingLiability.id, { name: form.name.trim(), type: form.type, value });
          setLiabilities((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        } else {
          const created = await createLiability({ name: form.name.trim(), type: form.type, value });
          setLiabilities((prev) => [...prev, created]);
        }
      }
      closeModal();
    } catch {
      setFormError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAsset(id: string) {
    setDeletingId(id);
    try {
      await deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (editingAsset?.id === id) closeModal();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteLiability(id: string) {
    setDeletingId(id);
    try {
      await deleteLiability(id);
      setLiabilities((prev) => prev.filter((l) => l.id !== id));
      if (editingLiability?.id === id) closeModal();
    } finally {
      setDeletingId(null);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-mint-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const netPositive = netWorth >= 0;

  return (
    <>
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-28 md:pb-8">

        {/* Cabeçalho */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Patrimônio</h1>
          <p className="text-gray-500 text-sm">Ativos, dívidas e evolução</p>
        </div>

        {/* Card principal — patrimônio líquido */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Patrimônio Líquido</p>
          <p className={`text-4xl font-bold mb-4 ${netPositive ? 'text-gray-900' : 'text-red-400'}`}>
            {formatCurrency(netWorth)}
          </p>
          <div className="flex gap-4">
            <div className="flex-1 bg-mint-50 border border-emerald-500/20 rounded-xl px-4 py-3">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Total ativos</p>
              <p className="text-mint-500 font-bold text-lg">{formatCurrency(totalAssets)}</p>
            </div>
            <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Total dívidas</p>
              <p className="text-red-400 font-bold text-lg">{formatCurrency(totalLiabilities)}</p>
            </div>
          </div>
        </div>

        {/* Bolsos patrimoniais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {(Object.keys(BOLSOS) as BolsoKey[]).map((key) => {
            const cfg = BOLSOS[key];
            const total = bolsoTotals[key];
            const pct = totalAssets > 0 ? (total / totalAssets) * 100 : 0;
            return (
              <div key={key} className={`bg-white border ${cfg.border} rounded-2xl p-4`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${cfg.bg} ${cfg.color}`}>
                  {cfg.icon}
                </div>
                <p className="text-gray-500 text-xs font-medium mb-0.5">{BOLSO_EMOJIS[key]} {cfg.label}</p>
                <p className={`font-bold text-base ${total > 0 ? cfg.color : 'text-gray-500'}`}>
                  {formatCurrency(total)}
                </p>
                {totalAssets > 0 && (
                  <p className="text-gray-500 text-[10px] mt-0.5">{pct.toFixed(0)}% do total</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Listas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          {/* Ativos */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 font-semibold text-sm">Ativos</h2>
              <button
                onClick={openAddAsset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-mint-50 border border-emerald-500/20 text-mint-500 text-xs font-semibold hover:bg-mint-50 transition-colors"
              >
                <Plus size={13} /> Adicionar
              </button>
            </div>

            {assets.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">Nenhum ativo cadastrado</p>
                <button onClick={openAddAsset} className="mt-3 text-xs text-mint-500 hover:text-mint-500">
                  + Adicionar primeiro ativo
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {assets.map((a) => {
                  const cfg = BOLSOS[a.type];
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gray-50/60 hover:bg-gray-50 transition-colors group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base">{BOLSO_EMOJIS[a.type]}</span>
                        <div className="min-w-0">
                          <p className="text-gray-900 text-sm font-medium truncate">{a.name}</p>
                          <p className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <p className="text-mint-500 font-semibold text-sm">{formatCurrency(a.value)}</p>
                        <button
                          onClick={() => openEditAsset(a)}
                          className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(a.id)}
                          disabled={deletingId === a.id}
                          className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {deletingId === a.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dívidas */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 font-semibold text-sm">Dívidas</h2>
              <button
                onClick={openAddLiability}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/15 transition-colors"
              >
                <Plus size={13} /> Adicionar
              </button>
            </div>

            {liabilities.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">Nenhuma dívida cadastrada</p>
                <p className="text-slate-700 text-xs mt-1">Ótimo sinal! 🎉</p>
              </div>
            ) : (
              <div className="space-y-2">
                {liabilities.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gray-50/60 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-gray-900 text-sm font-medium truncate">{l.name}</p>
                        <p className="text-[10px] font-medium text-red-400/70">{l.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <p className="text-red-400 font-semibold text-sm">{formatCurrency(l.value)}</p>
                      <button
                        onClick={() => openEditLiability(l)}
                        className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteLiability(l.id)}
                        disabled={deletingId === l.id}
                        className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {deletingId === l.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cards de aportes e evolução */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Aporte deste mês */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Saldo deste mês</p>
            <p className={`text-2xl font-bold mb-2 ${currentBalance >= 0 ? 'text-mint-500' : 'text-red-400'}`}>
              {formatCurrency(currentBalance)}
            </p>
            <div className="flex items-center gap-1.5">
              {balanceDiff >= 0 ? (
                <TrendingUp size={13} className="text-mint-500" />
              ) : (
                <TrendingDown size={13} className="text-red-400" />
              )}
              <p className={`text-xs font-medium ${balanceDiff >= 0 ? 'text-mint-500' : 'text-red-400'}`}>
                {balanceDiff >= 0 ? '+' : ''}{formatCurrency(balanceDiff)} vs mês anterior
              </p>
            </div>
          </div>

          {/* Evolução — gráfico */}
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-4">Saldo líquido mensal (12 meses)</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#a78bfa' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </main>

      {/* Modal de formulário */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-gray-900 font-semibold text-sm">
                {modalMode === 'asset'
                  ? editingAsset ? 'Editar ativo' : 'Novo ativo'
                  : editingLiability ? 'Editar dívida' : 'Nova dívida'}
              </p>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={modalMode === 'asset' ? 'Ex: Nubank, FGTS, Apartamento…' : 'Ex: Financiamento carro, Cartão…'}
                  autoFocus
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Tipo / Bolso
                </label>
                {modalMode === 'asset' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(BOLSOS) as BolsoKey[]).map((key) => {
                      const cfg = BOLSOS[key];
                      const active = form.type === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, type: key }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                            active
                              ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-slate-600'
                          }`}
                        >
                          <span>{BOLSO_EMOJIS[key]}</span>
                          <span className="text-xs font-medium">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {LIABILITY_TYPES.map((t) => {
                      const active = form.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, type: t }))}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                            active
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-slate-600'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Valor */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Valor (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    placeholder="0,00"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 text-base font-semibold placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {formError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-4">
                {formError}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.value}
                className="flex-1 py-3 rounded-xl bg-mint hover:bg-mint-700 disabled:opacity-50 text-gray-900 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Salvar</>}
              </button>
              {(editingAsset || editingLiability) && (
                <button
                  onClick={() => editingAsset ? handleDeleteAsset(editingAsset.id) : editingLiability && handleDeleteLiability(editingLiability.id)}
                  disabled={!!deletingId}
                  className="px-4 py-3 rounded-xl bg-gray-50 hover:bg-red-500/10 hover:border-red-500/30 border border-gray-200 text-gray-500 hover:text-red-400 transition-colors"
                >
                  {deletingId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              )}
              <button
                onClick={closeModal}
                className="px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
