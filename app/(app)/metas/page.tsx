'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2, Pencil, Plus, Target, Trash2, Trophy, TrendingUp, X } from 'lucide-react';
import {
  getGoals,
  getExpenses,
  getAllGoalContributions,
  createGoal as apiCreateGoal,
  updateGoal as apiUpdateGoal,
  deleteGoal as apiDeleteGoal,
  addGoalContribution,
} from '@/lib/storage';
import { calculateTotalByType, formatCurrency, getMonthKey } from '@/lib/calculations';
import { Goal, GoalContribution, GoalTerm, GoalType } from '@/lib/types';

// ─── Configurações de tipo e cor ─────────────────────────────────────────────

type ColorKey = 'violet' | 'blue' | 'green' | 'amber' | 'orange' | 'cyan' | 'emerald' | 'rose' | 'slate';

const GOAL_TYPES: Record<GoalType, { label: string; icon: string; color: ColorKey }> = {
  reserva:      { label: 'Reserva de Emergência', icon: '🛡️', color: 'blue' },
  viagem:       { label: 'Viagem',                icon: '✈️', color: 'violet' },
  carro:        { label: 'Carro',                 icon: '🚗', color: 'amber' },
  imovel:       { label: 'Imóvel',                icon: '🏠', color: 'green' },
  reforma:      { label: 'Reforma',               icon: '🔨', color: 'orange' },
  negocio:      { label: 'Negócio',               icon: '💼', color: 'cyan' },
  investimentos:{ label: 'Investimentos',         icon: '📈', color: 'emerald' },
  personalizada:{ label: 'Personalizada',         icon: '⭐', color: 'slate' },
};

const COLORS: ColorKey[] = ['violet', 'blue', 'green', 'amber', 'orange', 'cyan', 'emerald', 'rose', 'slate'];

const COLOR_CONFIG: Record<ColorKey, { bar: string; text: string; bg: string; border: string; dot: string }> = {
  violet:  { bar: 'bg-violet-500',  text: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-500' },
  blue:    { bar: 'bg-blue-500',    text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
  green:   { bar: 'bg-green-500',   text: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20',   dot: 'bg-green-500' },
  amber:   { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  orange:  { bar: 'bg-orange-500',  text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  dot: 'bg-orange-500' },
  cyan:    { bar: 'bg-cyan-500',    text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    dot: 'bg-cyan-500' },
  emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  rose:    { bar: 'bg-rose-500',    text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    dot: 'bg-rose-500' },
  slate:   { bar: 'bg-slate-500',   text: 'text-slate-400',   bg: 'bg-slate-800',      border: 'border-slate-700',      dot: 'bg-slate-500' },
};

function colorCfg(color: string) {
  return COLOR_CONFIG[(color as ColorKey) in COLOR_CONFIG ? (color as ColorKey) : 'slate'];
}

// ─── Prazo (term) ─────────────────────────────────────────────────────────────

const TERM_OPTIONS: { value: GoalTerm; label: string; badge: string }[] = [
  { value: 'curto', label: 'Curto prazo', badge: 'bg-green-500/15 text-green-400 border-green-500/20' },
  { value: 'medio', label: 'Médio prazo', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
  { value: 'longo', label: 'Longo prazo', badge: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
];

function termBadge(term: GoalTerm) {
  return TERM_OPTIONS.find((t) => t.value === term)!;
}

// ─── Emojis ───────────────────────────────────────────────────────────────────

const EMOJI_OPTIONS = [
  '🏠', '🚗', '✈️', '🎓', '💍', '🏖️', '💻', '🎯',
  '🌍', '🏋️', '🎸', '👶', '🐕', '🏦', '💎', '🚀',
  '🛡️', '📈', '🔨', '💼', '⭐', '💰', '🌟', '🏆',
  '🎵', '📚', '🌱', '🎉',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthsDiff(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function completionLabel(monthsFromNow: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

type GoalHealthStatus = 'verde' | 'amarelo' | 'vermelho';

function computeStatus(goal: Goal, contributions: GoalContribution[]): GoalHealthStatus | null {
  if (goal.status === 'completed' || !goal.deadline) return null;

  const now = new Date();
  const dl = new Date(goal.deadline + 'T12:00:00');
  const monthsLeft = monthsDiff(now, dl);

  if (monthsLeft <= 0) return 'vermelho';

  const remaining = goal.targetAmount - goal.currentAmount;
  const requiredPace = remaining / monthsLeft;

  if (contributions.length === 0) {
    return monthsLeft <= 2 ? 'vermelho' : 'amarelo';
  }

  const totalContribs = contributions.reduce((s, c) => s + c.amount, 0);
  const oldest = contributions[contributions.length - 1];
  const firstDate = new Date(oldest.date + 'T12:00:00');
  const contribMonths = Math.max(monthsDiff(firstDate, now), 1);
  const actualPace = totalContribs / contribMonths;

  if (actualPace >= requiredPace * 0.9) return 'verde';
  if (actualPace >= requiredPace * 0.5) return 'amarelo';
  return 'vermelho';
}

type InsightItem = { icon: string; text: string };

function computeInsights(goal: Goal, contributions: GoalContribution[], avgMonthlySpent: number): InsightItem[] {
  const now = new Date();
  const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  if (pct >= 100) return [{ icon: '🎉', text: 'Meta concluída!' }];

  const items: InsightItem[] = [];

  items.push({ icon: '💰', text: `Faltam ${formatCurrency(remaining)} para concluir` });

  if (contributions.length > 0) {
    const totalContribs = contributions.reduce((s, c) => s + c.amount, 0);
    const oldest = contributions[contributions.length - 1];
    const firstDate = new Date(oldest.date + 'T12:00:00');
    const months = Math.max(monthsDiff(firstDate, now), 1);
    const pace = totalContribs / months;
    if (pace > 0) {
      const monthsToGo = Math.ceil(remaining / pace);
      items.push({ icon: '📈', text: `No ritmo atual, conclui em ${monthsToGo} ${monthsToGo === 1 ? 'mês' : 'meses'}` });
    }
  }

  if (goal.deadline) {
    const dl = new Date(goal.deadline + 'T12:00:00');
    const left = monthsDiff(now, dl);
    if (left <= 0) {
      items.push({ icon: '⚠️', text: 'Prazo atingido — meta ainda em aberto' });
    } else if (contributions.length > 0) {
      const totalContribs = contributions.reduce((s, c) => s + c.amount, 0);
      const oldest = contributions[contributions.length - 1];
      const contribMonths = Math.max(monthsDiff(new Date(oldest.date + 'T12:00:00'), now), 1);
      const pace = totalContribs / contribMonths;
      const needed = remaining / left;
      if (pace > 0 && pace < needed * 0.75) {
        items.push({ icon: '⚠️', text: `Ritmo insuficiente — precisa de ${formatCurrency(needed)}/mês` });
      }
    }
  }

  if (goal.type === 'reserva' && avgMonthlySpent > 0) {
    const ideal = avgMonthlySpent * 6;
    if (goal.targetAmount < ideal * 0.9) {
      items.push({ icon: '🛡️', text: `Reserva ideal (6× gastos médios): ${formatCurrency(ideal)}` });
    } else {
      items.push({ icon: '✅', text: 'Meta alinhada com 6× seus gastos médios' });
    }
  }

  return items;
}

// ─── Componente principal ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  type: 'personalizada' as GoalType,
  targetAmount: '',
  currentAmount: '',
  deadline: '',
  color: 'slate' as ColorKey,
  term: '' as '' | GoalTerm,
  emoji: '',
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function MetasPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [avgMonthlySpent, setAvgMonthlySpent] = useState(0);
  const [currentMonthBalance, setCurrentMonthBalance] = useState(0);
  const [ready, setReady] = useState(false);
  const [celebratingGoal, setCelebratingGoal] = useState<Goal | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Contribuição
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(TODAY);
  const [contribNote, setContribNote] = useState('');
  const [contribSaving, setContribSaving] = useState(false);
  const [contribError, setContribError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getGoals(), getAllGoalContributions(), getExpenses()]).then(([gs, cs, exps]) => {
      setGoals(gs);
      setContributions(cs);

      const now = new Date();

      const currentMonthKey = getMonthKey(now);
      const currentEntries = exps.filter((e) => e.date.slice(0, 7) === currentMonthKey);
      const income = calculateTotalByType(currentEntries, 'income');
      const spent = calculateTotalByType(currentEntries, 'expense');
      setCurrentMonthBalance(Math.max(0, income - spent));

      const amounts: number[] = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = getMonthKey(d);
        const total = calculateTotalByType(
          exps.filter((e) => e.date.slice(0, 7) === key),
          'expense'
        );
        if (total > 0) amounts.push(total);
      }
      setAvgMonthlySpent(amounts.length ? amounts.reduce((a, b) => a + b) / amounts.length : 0);
      setReady(true);
    });
  }, []);

  // ── Form helpers ───────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(goal: Goal) {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      type: goal.type,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      deadline: goal.deadline ?? '',
      color: (goal.color as ColorKey) in COLOR_CONFIG ? (goal.color as ColorKey) : 'slate',
      term: goal.term ?? '',
      emoji: goal.emoji ?? '',
    });
    setFormError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function handleTypeChange(type: GoalType) {
    setForm((f) => ({ ...f, type, color: GOAL_TYPES[type].color }));
  }

  async function handleSave() {
    setFormError(null);
    const target = parseFloat(form.targetAmount.replace(',', '.'));
    const current = parseFloat(form.currentAmount.replace(',', '.')) || 0;

    if (!form.name.trim()) { setFormError('Informe o nome da meta.'); return; }
    if (!target || target <= 0) { setFormError('O valor alvo deve ser maior que zero.'); return; }
    if (current < 0) { setFormError('O valor inicial não pode ser negativo.'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        targetAmount: target,
        currentAmount: current,
        deadline: form.deadline || undefined,
        color: form.color,
        status: (current >= target ? 'completed' : 'active') as 'active' | 'completed',
        term: (form.term || undefined) as GoalTerm | undefined,
        emoji: form.emoji || undefined,
      };
      if (editingId) {
        const updated = await apiUpdateGoal(editingId, payload);
        setGoals((prev) => prev.map((g) => (g.id === editingId ? updated : g)));
      } else {
        const created = await apiCreateGoal(payload);
        setGoals((prev) => [...prev, created]);
      }
      closeForm();
    } catch (err) {
      console.error('handleSave:', err instanceof Error ? err.message : err);
      setFormError('Não foi possível salvar a meta. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await apiDeleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
      setContributions((prev) => prev.filter((c) => c.goalId !== id));
      if (editingId === id) closeForm();
    } finally {
      setDeletingId(null);
    }
  }

  // ── Contribuição ───────────────────────────────────────────────────────────

  function openContrib(goal: Goal) {
    setContributingGoal(goal);
    setContribAmount('');
    setContribDate(TODAY);
    setContribNote('');
    setContribError(null);
  }

  async function handleContrib() {
    if (!contributingGoal) return;
    setContribError(null);
    const amount = parseFloat(contribAmount.replace(',', '.'));
    if (!amount || amount <= 0) { setContribError('Informe um valor maior que zero.'); return; }

    const wasActive = contributingGoal.status === 'active';

    setContribSaving(true);
    try {
      const updatedGoal = await addGoalContribution(
        contributingGoal.id,
        amount,
        contribNote || undefined,
        contribDate || TODAY
      );
      setGoals((prev) => prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g)));
      const newContrib: GoalContribution = {
        id: `tmp-${Date.now()}`,
        goalId: contributingGoal.id,
        amount,
        note: contribNote || undefined,
        date: contribDate || TODAY,
        createdAt: new Date().toISOString(),
      };
      setContributions((prev) => [newContrib, ...prev]);

      if (wasActive && updatedGoal.status === 'completed') {
        setCelebratingGoal(updatedGoal);
      }

      setContributingGoal(null);
    } catch (err) {
      console.error('handleContrib:', err instanceof Error ? err.message : err);
      setContribError('Não foi possível registrar o aporte. Tente novamente.');
    } finally {
      setContribSaving(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  // ── Derivadas ──────────────────────────────────────────────────────────────

  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const nextGoal = activeGoals
    .filter((g) => g.targetAmount > 0)
    .sort((a, b) => b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount)[0] ?? null;

  const contribsByGoal = contributions.reduce<Record<string, GoalContribution[]>>((acc, c) => {
    if (!acc[c.goalId]) acc[c.goalId] = [];
    acc[c.goalId].push(c);
    return acc;
  }, {});

  const goalIcon = (goal: Goal) => goal.emoji ?? GOAL_TYPES[goal.type].icon;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Metas</h1>
            <p className="text-slate-400 text-sm">Construindo patrimônio</p>
          </div>
          {!showForm && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-sm font-semibold transition-all"
            >
              <Plus size={16} /> Nova meta
            </button>
          )}
        </div>

        {/* Cards de resumo */}
        {goals.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Total guardado</p>
              <p className="text-green-400 font-bold text-lg leading-tight">{formatCurrency(totalSaved)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Metas ativas</p>
              <p className="text-white font-bold text-lg leading-tight">{activeGoals.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Próxima</p>
              {nextGoal ? (
                <>
                  <p className="text-white font-bold text-sm leading-tight truncate">{nextGoal.name}</p>
                  <p className={`text-xs mt-0.5 font-semibold ${colorCfg(nextGoal.color).text}`}>
                    {Math.round((nextGoal.currentAmount / nextGoal.targetAmount) * 100)}%
                  </p>
                </>
              ) : (
                <p className="text-slate-600 text-sm">—</p>
              )}
            </div>
          </div>
        )}

        {/* Formulário de criação / edição */}
        {showForm && (
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-5 mb-6">
            <p className="text-slate-200 font-semibold text-sm mb-4">
              {editingId ? 'Editar meta' : 'Nova meta'}
            </p>
            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Nome da meta</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Viagem Europa, Reserva de emergência…"
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              {/* Tipo */}
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Tipo</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(Object.keys(GOAL_TYPES) as GoalType[]).map((t) => {
                    const cfg = GOAL_TYPES[t];
                    const active = form.type === t;
                    return (
                      <button key={t} type="button" onClick={() => handleTypeChange(t)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                          active ? 'bg-violet-500/10 border-violet-500/40 text-white'
                                 : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        <span>{cfg.icon}</span>
                        <span className="text-xs font-medium truncate">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Emoji personalizado */}
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Emoji da meta{' '}
                  <span className="normal-case text-slate-600">(opcional — substitui o ícone de categoria)</span>
                </label>
                <div className="grid grid-cols-7 md:grid-cols-14 gap-1.5">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, emoji: f.emoji === e ? '' : e }))}
                      className={`h-9 rounded-xl text-lg flex items-center justify-center transition-all ${
                        form.emoji === e
                          ? 'bg-violet-500/20 border border-violet-500/50 scale-110'
                          : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:scale-105'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                {form.emoji && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, emoji: '' }))}
                    className="mt-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    ✕ Remover emoji
                  </button>
                )}
              </div>
              {/* Valores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Valor alvo (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                    <input type="number" inputMode="decimal" step="0.01" min="0" value={form.targetAmount}
                      onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                      placeholder="0,00"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-base font-semibold placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Já tenho (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                    <input type="number" inputMode="decimal" step="0.01" min="0" value={form.currentAmount}
                      onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
                      placeholder="0,00"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-base font-semibold placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
              {/* Prazo e cor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Prazo (opcional)</label>
                  <input type="date" value={form.deadline}
                    onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Cor</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`w-7 h-7 rounded-full ${COLOR_CONFIG[c].dot} transition-all ${
                          form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Classificação de prazo */}
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Classificação de prazo <span className="normal-case text-slate-600">(opcional)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {TERM_OPTIONS.map((opt) => {
                    const active = form.term === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, term: f.term === opt.value ? '' : opt.value }))}
                        className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                          active
                            ? opt.badge
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {formError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-4">{formError}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.targetAmount}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> {editingId ? 'Salvar' : 'Criar meta'}</>}
              </button>
              {editingId && (
                <button onClick={() => handleDelete(editingId)} disabled={deletingId === editingId}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-red-500/10 hover:border-red-500/30 border border-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                >
                  {deletingId === editingId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              )}
              <button onClick={closeForm}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                aria-label="Cancelar"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {goals.length === 0 && !showForm && (
          <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
            <Target size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm mb-1">Nenhuma meta criada ainda</p>
            <p className="text-slate-600 text-xs mb-5">Defina seus objetivos e acompanhe a evolução</p>
            <button onClick={openCreate}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-sm font-semibold transition-all"
            >
              Criar primeira meta
            </button>
          </div>
        )}

        {/* Metas ativas */}
        {activeGoals.length > 0 && (
          <>
            {completedGoals.length > 0 && (
              <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Ativas</h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {activeGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal}
                  contributions={contribsByGoal[goal.id] ?? []}
                  avgMonthlySpent={avgMonthlySpent}
                  currentMonthBalance={currentMonthBalance}
                  icon={goalIcon(goal)}
                  onEdit={openEdit}
                  onContrib={openContrib}
                />
              ))}
            </div>
          </>
        )}

        {/* Vitórias */}
        {completedGoals.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={13} className="text-emerald-400" />
              <h2 className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Vitórias</h2>
              <span className="text-emerald-900 text-xs">({completedGoals.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedGoals.map((goal) => (
                <VictoryCard key={goal.id} goal={goal}
                  contributions={contribsByGoal[goal.id] ?? []}
                  icon={goalIcon(goal)}
                  onEdit={openEdit}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Modal de contribuição */}
      {contributingGoal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setContributingGoal(null); }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${colorCfg(contributingGoal.color).bg} border ${colorCfg(contributingGoal.color).border}`}>
                  {goalIcon(contributingGoal)}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{contributingGoal.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {formatCurrency(contributingGoal.currentAmount)} / {formatCurrency(contributingGoal.targetAmount)}
                  </p>
                </div>
              </div>
              <button onClick={() => setContributingGoal(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                  <input type="number" inputMode="decimal" step="0.01" min="0.01" value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    placeholder="0,00" autoFocus
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-base font-semibold placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Data</label>
                <input type="date" value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Observação (opcional)</label>
                <input type="text" value={contribNote}
                  onChange={(e) => setContribNote(e.target.value)}
                  placeholder="Ex: salário de abril, bônus…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            {contribError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mt-3">{contribError}</p>
            )}

            <button onClick={handleContrib} disabled={contribSaving || !contribAmount}
              className="w-full mt-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {contribSaving ? <Loader2 size={16} className="animate-spin" /> : <><TrendingUp size={16} /> Registrar aporte</>}
            </button>
          </div>
        </div>
      )}

      {/* Animação de celebração */}
      {celebratingGoal && (
        <CelebrationOverlay
          goal={celebratingGoal}
          icon={goalIcon(celebratingGoal)}
          onDone={() => setCelebratingGoal(null)}
        />
      )}
    </>
  );
}

// ─── Celebração ───────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  'bg-emerald-400', 'bg-green-300', 'bg-violet-400',
  'bg-yellow-300', 'bg-white', 'bg-cyan-400', 'bg-rose-400', 'bg-amber-300',
];

function CelebrationOverlay({
  goal,
  icon,
  onDone,
}: {
  goal: Goal;
  icon: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const particles = useMemo(() =>
    Array.from({ length: 48 }, (_, i) => ({
      id: i,
      left: `${(i / 48) * 100 + (Math.sin(i) * 4)}%`,
      duration: `${1.4 + (i % 5) * 0.3}s`,
      delay: `${(i % 8) * 0.1}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: i % 3 === 0 ? 'w-2 h-2 rounded-sm' : i % 3 === 1 ? 'w-1.5 h-3 rounded-sm' : 'w-2.5 h-1 rounded-full',
    }))
  , []);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <style>{`
        @keyframes cffall {
          0%   { transform: translateY(-16px) rotate(0deg) scale(1); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg) scale(0.6); opacity: 0; }
        }
        @keyframes celebrate-in {
          0%   { opacity: 0; transform: scale(0.7); }
          60%  { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        .cf-particle { animation: cffall var(--d) ease-in var(--dl) both; }
        .celebrate-card { animation: celebrate-in 0.4s cubic-bezier(.34,1.56,.64,1) both; }
      `}</style>

      {/* Confetti */}
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute top-0 ${p.color} ${p.shape} cf-particle`}
          style={{ left: p.left, '--d': p.duration, '--dl': p.delay } as React.CSSProperties}
        />
      ))}

      {/* Overlay escuro clicável para fechar */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center"
        onClick={onDone}
      >
        <div
          className="celebrate-card bg-slate-900 border border-emerald-500/40 rounded-3xl px-10 py-8 text-center shadow-2xl shadow-emerald-900/50 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-5xl mb-2 animate-bounce">{icon}</div>
          <div className="text-3xl mb-3">🎉</div>
          <p className="text-white font-bold text-xl mb-1">Meta concluída!</p>
          <p className="text-emerald-400 text-sm font-medium mb-1">{goal.name}</p>
          <p className="text-slate-300 text-sm">{formatCurrency(goal.currentAmount)} guardados</p>
          <p className="text-slate-600 text-xs mt-4">Clique para continuar</p>
        </div>
      </div>
    </div>
  );
}

// ─── Card de vitória (metas concluídas) ───────────────────────────────────────

function VictoryCard({
  goal,
  contributions,
  icon,
  onEdit,
}: {
  goal: Goal;
  contributions: GoalContribution[];
  icon: string;
  onEdit: (g: Goal) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Contributions chegam desc (mais recente primeiro) → contributions[0] = conclusão
  const completionDate = contributions.length > 0
    ? contributions[0].date
    : goal.createdAt.slice(0, 10);

  // Linha do tempo: ordem cronológica (mais antigo → mais recente)
  const timeline = useMemo(() => [...contributions].reverse(), [contributions]);

  return (
    <div className="rounded-2xl overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-green-950/15">
      <div className="p-5">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-2xl flex-shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">{goal.name}</p>
              <p className="text-emerald-400 text-xs mt-0.5">
                🏆 Concluída em {formatShortDate(completionDate)}
              </p>
              {goal.term && (
                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-1 ${termBadge(goal.term).badge}`}>
                  {termBadge(goal.term).label.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => onEdit(goal)}
            className="w-8 h-8 rounded-lg bg-slate-800/60 flex items-center justify-center text-slate-500 hover:text-white transition-colors flex-shrink-0 ml-2"
          >
            <Pencil size={13} />
          </button>
        </div>

        {/* Valor */}
        <div className="mb-3">
          <p className="text-emerald-400 font-bold text-2xl">{formatCurrency(goal.currentAmount)}</p>
          <p className="text-slate-500 text-xs mt-0.5">guardados de {formatCurrency(goal.targetAmount)}</p>
        </div>

        {/* Barra completa */}
        <div className="h-2 rounded-full overflow-hidden mb-4 bg-emerald-950/60">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" />
        </div>

        {/* Botão "Ver conquista" */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/15 transition-colors"
        >
          <Trophy size={13} />
          {expanded ? 'Ocultar conquista' : 'Ver conquista'}
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {/* Timeline expandida */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-emerald-900/40">
            {timeline.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-2">Nenhum aporte registrado.</p>
            ) : (
              <>
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-3">Linha do tempo</p>
                <div>
                  {timeline.map((c, idx) => {
                    const isLast = idx === timeline.length - 1;
                    return (
                      <div key={c.id} className="flex items-start gap-3">
                        {/* Conector */}
                        <div className="flex flex-col items-center pt-1 w-3 flex-shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                            isLast
                              ? 'border-emerald-400 bg-emerald-400'
                              : 'border-slate-600 bg-slate-900'
                          }`} />
                          {!isLast && <div className="w-px flex-1 bg-slate-800 min-h-[20px] mt-0.5" />}
                        </div>
                        {/* Conteúdo */}
                        <div className={`flex-1 flex items-start justify-between pb-3 ${isLast ? '' : ''}`}>
                          <div>
                            <p className={`text-xs font-medium ${isLast ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {formatShortDate(c.date)}{isLast ? ' ✓' : ''}
                            </p>
                            {c.note && (
                              <p className="text-slate-500 text-xs mt-0.5">{c.note}</p>
                            )}
                          </div>
                          <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${isLast ? 'text-emerald-400' : 'text-slate-300'}`}>
                            +{formatCurrency(c.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Total */}
                <div className="mt-1 pt-3 border-t border-emerald-900/40 flex justify-between items-center">
                  <span className="text-slate-500 text-xs">{timeline.length} {timeline.length === 1 ? 'aporte' : 'aportes'}</span>
                  <span className="text-emerald-400 text-xs font-bold">
                    {formatCurrency(timeline.reduce((s, c) => s + c.amount, 0))} total aportado
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card de meta ativa ───────────────────────────────────────────────────────

function GoalCard({
  goal,
  contributions,
  avgMonthlySpent,
  currentMonthBalance,
  icon,
  onEdit,
  onContrib,
}: {
  goal: Goal;
  contributions: GoalContribution[];
  avgMonthlySpent: number;
  currentMonthBalance: number;
  icon: string;
  onEdit: (g: Goal) => void;
  onContrib: (g: Goal) => void;
}) {
  const [simInput, setSimInput] = useState('');

  const now = new Date();
  const cfg = colorCfg(goal.color);
  const typeCfg = GOAL_TYPES[goal.type];
  const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isCompleted = goal.status === 'completed';

  const deadlineDate = goal.deadline ? new Date(goal.deadline + 'T12:00:00') : null;
  const monthsLeft = deadlineDate
    ? Math.max(0, (deadlineDate.getFullYear() - now.getFullYear()) * 12 + (deadlineDate.getMonth() - now.getMonth()))
    : null;
  const monthlySuggestion = monthsLeft && monthsLeft > 0 && remaining > 0 ? remaining / monthsLeft : null;

  const status = computeStatus(goal, contributions);
  const insights = computeInsights(goal, contributions, avgMonthlySpent);

  const statusLabel: Record<'verde' | 'amarelo' | 'vermelho', string> = {
    verde: 'No prazo',
    amarelo: 'Atenção',
    vermelho: 'Atrasada',
  };
  const statusClass: Record<'verde' | 'amarelo' | 'vermelho', string> = {
    verde: 'bg-green-500/15 text-green-400',
    amarelo: 'bg-yellow-500/15 text-yellow-400',
    vermelho: 'bg-red-500/15 text-red-400',
  };

  const simMonthly = parseFloat(simInput.replace(',', '.'));
  const simValid = simMonthly > 0 && remaining > 0;
  const simMonths = simValid ? Math.ceil(remaining / simMonthly) : null;

  const suggestMonths = currentMonthBalance > 0 && remaining > 0
    ? Math.ceil(remaining / currentMonthBalance)
    : null;

  return (
    <div className={`rounded-2xl p-5 border ${isCompleted ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-900 border-slate-800'}`}>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-sm leading-tight truncate">{goal.name}</p>
              {status && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusClass[status]}`}>
                  {statusLabel[status].toUpperCase()}
                </span>
              )}
              {goal.term && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${termBadge(goal.term).badge}`}>
                  {termBadge(goal.term).label.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-0.5">{typeCfg.label}</p>
          </div>
        </div>
        <button onClick={() => onEdit(goal)}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-white transition-colors flex-shrink-0 ml-2"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Valores e barra */}
      <div className="mb-3">
        <div className="flex items-end justify-between mb-1.5">
          <div>
            <p className={`text-2xl font-bold ${isCompleted ? 'text-green-400' : cfg.text}`}>
              {formatCurrency(goal.currentAmount)}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">de {formatCurrency(goal.targetAmount)}</p>
          </div>
          <p className={`text-xl font-bold ${isCompleted ? 'text-green-400' : 'text-slate-300'}`}>
            {Math.round(pct)}%
          </p>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : cfg.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Prazo e sugestão mensal */}
      {!isCompleted && (deadlineDate || monthlySuggestion) && (
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="text-slate-500">
            {deadlineDate && (
              monthsLeft === 0
                ? <span className="text-red-400 font-medium">⚠ Prazo atingido</span>
                : <span>Até {deadlineDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })} · {monthsLeft} {monthsLeft === 1 ? 'mês' : 'meses'}</span>
            )}
          </span>
          {monthlySuggestion && (
            <span className={`font-semibold ${cfg.text}`}>
              {formatCurrency(monthlySuggestion)}/mês
            </span>
          )}
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {insights.slice(0, 3).map((ins, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
              <span className="flex-shrink-0 text-sm leading-none mt-px">{ins.icon}</span>
              <span>{ins.text}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Simulador */}
      {!isCompleted && (
        <div className="mb-4 pt-3 border-t border-slate-800">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">Simulador</p>
          <div className="relative mb-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">R$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder="Se eu aportar… /mês"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          {simInput !== '' && (
            simMonths === null
              ? <p className="text-slate-500 text-xs">Informe um valor maior que zero.</p>
              : <p className="text-slate-300 text-xs">
                  Você conclui em{' '}
                  <span className={`font-bold ${cfg.text}`}>{simMonths} {simMonths === 1 ? 'mês' : 'meses'}</span>
                  {' '}({completionLabel(simMonths)})
                </p>
          )}
          {currentMonthBalance > 0 && suggestMonths !== null && (
            <div className="mt-2 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <p className="text-slate-400 text-xs leading-relaxed">
                💡 Com seu saldo de{' '}
                <span className="text-white font-semibold">{formatCurrency(currentMonthBalance)}</span>
                {' '}este mês, você poderia aportar esse valor e concluir em{' '}
                <span className={`font-bold ${cfg.text}`}>{suggestMonths} {suggestMonths === 1 ? 'mês' : 'meses'}</span>
                {' '}({completionLabel(suggestMonths)})
              </p>
            </div>
          )}
        </div>
      )}

      {/* Últimos aportes */}
      {contributions.length > 0 && (
        <div className="mb-4 pt-3 border-t border-slate-800">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">Últimos aportes</p>
          <div className="space-y-1.5">
            {contributions.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-600 text-xs flex-shrink-0">{formatShortDate(c.date)}</span>
                  {c.note && <span className="text-slate-500 text-xs truncate">{c.note}</span>}
                </div>
                <span className={`text-xs font-semibold flex-shrink-0 ${cfg.text}`}>
                  +{formatCurrency(c.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão aportar */}
      {!isCompleted ? (
        <button onClick={() => onContrib(goal)}
          className={`w-full py-2.5 rounded-xl border ${cfg.border} ${cfg.bg} ${cfg.text} hover:opacity-80 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all`}
        >
          <Plus size={15} /> Adicionar valor
        </button>
      ) : (
        <div className="w-full py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold text-center">
          🎉 Meta alcançada!
        </div>
      )}
    </div>
  );
}
