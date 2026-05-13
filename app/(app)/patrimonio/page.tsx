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
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Patrimônio</h1>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>Ativos, dívidas e evolução</p>
        </div>

        {/* Card patrimônio líquido */}
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 20, marginBottom: 12, boxShadow: 'var(--card-shadow)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>PATRIMÔNIO LÍQUIDO</p>
          <p style={{ fontSize: 32, fontWeight: 900, color: netPositive ? 'var(--text)' : 'var(--red)', letterSpacing: '-0.03em', marginBottom: 16 }}>
            {formatCurrency(netWorth)}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'var(--green-bg)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>TOTAL ATIVOS</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', margin: 0 }}>{formatCurrency(totalAssets)}</p>
            </div>
            <div style={{ background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, opacity: 0.8 }}>TOTAL DÍVIDAS</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--red)', margin: 0 }}>{formatCurrency(totalLiabilities)}</p>
            </div>
          </div>
        </div>

        {/* Grid de categorias */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }} className="md:grid-cols-4">
          {(Object.keys(BOLSOS) as BolsoKey[]).map((key) => {
            const cfg = BOLSOS[key];
            const total = bolsoTotals[key];
            const pct = totalAssets > 0 ? (total / totalAssets) * 100 : 0;
            return (
              <div key={key} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 14, boxShadow: 'var(--card-shadow)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, background: 'var(--accent-bg)' }}>
                  <span style={{ color: 'var(--accent)', display: 'flex' }}>{cfg.icon}</span>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>{BOLSO_EMOJIS[key]} {cfg.label}</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: total > 0 ? 'var(--green)' : 'var(--text-3)', margin: 0 }}>
                  {formatCurrency(total)}
                </p>
                {totalAssets > 0 && (
                  <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 2 }}>{pct.toFixed(0)}% do total</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Listas */}
        {assets.length === 0 && liabilities.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', marginBottom: 20 }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🏦</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Seu patrimônio começa aqui</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginBottom: 20, maxWidth: 280, margin: '0 auto 20px' }}>
              Cadastre seus bens e dívidas para acompanhar seu patrimônio líquido ao longo do tempo.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={openAddAsset} style={{ background: 'var(--green)', color: 'white', fontSize: 13, fontWeight: 700, borderRadius: 'var(--r-sm)', border: 'none', padding: '10px 18px', cursor: 'pointer' }}>
                + Adicionar ativo
              </button>
              <button onClick={openAddLiability} style={{ background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', padding: '10px 18px', cursor: 'pointer' }}>
                + Adicionar dívida
              </button>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          {/* Ativos */}
          <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 18, boxShadow: 'var(--card-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Ativos</p>
              <button
                onClick={openAddAsset}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--green-bg)', border: '1px solid rgba(0,195,122,0.2)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, color: 'var(--green)', cursor: 'pointer' }}
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>

            {assets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nenhum ativo cadastrado</p>
                <button onClick={openAddAsset} style={{ marginTop: 8, fontSize: 12, color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  + Adicionar primeiro ativo
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {assets.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--bg)' }} className="group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 16 }}>{BOLSO_EMOJIS[a.type]}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>{BOLSOS[a.type].label}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', margin: 0 }}>{formatCurrency(a.value)}</p>
                      <button onClick={() => openEditAsset(a)} style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--border-2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Pencil size={11} color="var(--text-2)" />
                      </button>
                      <button onClick={() => handleDeleteAsset(a.id)} disabled={deletingId === a.id} style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--border-2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        {deletingId === a.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} color="var(--red)" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dívidas */}
          <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 18, boxShadow: 'var(--card-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Dívidas</p>
              <button
                onClick={openAddLiability}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--red-bg)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, color: 'var(--red)', cursor: 'pointer' }}
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>

            {liabilities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nenhuma dívida cadastrada</p>
                <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>Ótimo sinal! 🎉</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {liabilities.map((l) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <AlertCircle size={15} color="var(--red)" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</p>
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', marginTop: 2, opacity: 0.7 }}>{l.type}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)', margin: 0 }}>{formatCurrency(l.value)}</p>
                      <button onClick={() => openEditLiability(l)} style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--border-2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Pencil size={11} color="var(--text-2)" />
                      </button>
                      <button onClick={() => handleDeleteLiability(l.id)} disabled={deletingId === l.id} style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--border-2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        {deletingId === l.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} color="var(--red)" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Cards de aportes e evolução */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Saldo deste mês */}
          <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 18, boxShadow: 'var(--card-shadow)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Saldo deste mês</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: currentBalance >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 8 }}>
              {formatCurrency(currentBalance)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {balanceDiff >= 0 ? (
                <TrendingUp size={13} color="var(--green)" />
              ) : (
                <TrendingDown size={13} color="var(--red)" />
              )}
              <p style={{ fontSize: 12, fontWeight: 600, color: balanceDiff >= 0 ? 'var(--green)' : 'var(--red)', margin: 0 }}>
                {balanceDiff >= 0 ? '+' : ''}{formatCurrency(balanceDiff)} vs mês anterior
              </p>
            </div>
          </div>

          {/* Evolução — gráfico */}
          <div className="md:col-span-2" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 18, boxShadow: 'var(--card-shadow)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Saldo líquido mensal (12 meses)</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--text-3)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-3)', fontSize: 10 }}
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
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'var(--accent)' }}
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
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '20px 20px 0 0', padding: 24 }} className="md:rounded-2xl">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {modalMode === 'asset'
                  ? editingAsset ? 'Editar ativo' : 'Novo ativo'
                  : editingLiability ? 'Editar dívida' : 'Nova dívida'}
              </p>
              <button
                onClick={closeModal}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={15} color="var(--text-2)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Nome */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={modalMode === 'asset' ? 'Ex: Nubank, FGTS, Apartamento…' : 'Ex: Financiamento carro, Cartão…'}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                />
              </div>

              {/* Tipo */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  Tipo / Bolso
                </label>
                {modalMode === 'asset' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(Object.keys(BOLSOS) as BolsoKey[]).map((key) => {
                      const active = form.type === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, type: key }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 12px', borderRadius: 'var(--r-sm)',
                            border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            background: active ? 'var(--accent-bg)' : 'var(--bg)',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{BOLSO_EMOJIS[key]}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-2)' }}>{BOLSOS[key].label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {LIABILITY_TYPES.map((t) => {
                      const active = form.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, type: t }))}
                          style={{
                            padding: '7px 14px', borderRadius: 'var(--r-sm)',
                            border: `1.5px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                            background: active ? 'var(--red-bg)' : 'var(--bg)',
                            fontSize: 12, fontWeight: 600,
                            color: active ? 'var(--red)' : 'var(--text-2)',
                            cursor: 'pointer',
                          }}
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
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  Valor (R$)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-3)' }}>R$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    placeholder="0,00"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px 12px 42px', fontSize: 16, fontWeight: 700, color: 'var(--text)', outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            {formError && (
              <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px', marginTop: 12 }}>
                {formError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.value}
                style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--r-sm)', background: 'var(--green)', border: 'none', fontSize: 14, fontWeight: 800, color: 'white', cursor: 'pointer', opacity: (saving || !form.name.trim() || !form.value) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Salvar</>}
              </button>
              {(editingAsset || editingLiability) && (
                <button
                  onClick={() => editingAsset ? handleDeleteAsset(editingAsset.id) : editingLiability && handleDeleteLiability(editingLiability.id)}
                  disabled={!!deletingId}
                  style={{ padding: '14px 16px', borderRadius: 'var(--r-sm)', background: 'var(--red-bg)', border: '1.5px solid var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {deletingId ? <Loader2 size={16} color="var(--red)" className="animate-spin" /> : <Trash2 size={16} color="var(--red)" />}
                </button>
              )}
              <button
                onClick={closeModal}
                style={{ padding: '14px 16px', borderRadius: 'var(--r-sm)', background: 'var(--bg)', border: '1.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color="var(--text-2)" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
