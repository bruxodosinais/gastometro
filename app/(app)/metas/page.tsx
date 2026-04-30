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

function getSimulatorMessage(meses: number): { text: string; cls: string } {
  if (meses > 60) return { text: `Muito lento — levará ${meses} meses`, cls: 'text-red-400' };
  if (meses > 24) return { text: `Lento — levará ${meses} meses`,       cls: 'text-yellow-400' };
  return { text: `Você conclui em ${meses} meses`,                       cls: 'text-green-400' };
}

function getStatus(progress: number) {
  if (progress < 0.6) return 'atrasada';
  if (progress < 0.9) return 'atencao';
  return 'no-ritmo';
}

const STATUS_CONFIG = {
  atrasada:  { label: '🔴 Atrasada', cls: 'text-red-400',    bar: 'bg-red-500',    btnLabel: 'Aportar agora' },
  atencao:   { label: '🟡 Atenção',  cls: 'text-yellow-400', bar: 'bg-yellow-500', btnLabel: 'Aumentar aporte' },
  'no-ritmo':{ label: '🟢 No ritmo', cls: 'text-green-400',  bar: 'bg-green-500',  btnLabel: 'Manter plano' },
};

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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setShowAdvanced(false);
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
    setShowAdvanced(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowAdvanced(false);
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

  const statusPriority: Record<string, number> = { atrasada: 0, atencao: 1, 'no-ritmo': 2 };
  const sortedActiveGoals = [...activeGoals].sort((a, b) => {
    const progA = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
    const progB = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
    const statusDiff = statusPriority[getStatus(progA)] - statusPriority[getStatus(progB)];
    if (statusDiff !== 0) return statusDiff;
    return progB - progA;
  });

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
              {/* Configurações avançadas */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
              >
                {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Configurações avançadas
              </button>
              {showAdvanced && (
                <>
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
                </>
              )}
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
              {sortedActiveGoals.map((goal, i) => (
                <GoalCard key={goal.id} goal={goal}
                  contributions={contribsByGoal[goal.id] ?? []}
                  icon={goalIcon(goal)}
                  isPriority={i === 0}
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
  icon,
  isPriority,
  onEdit,
  onContrib,
}: {
  goal: Goal;
  contributions: GoalContribution[];
  icon: string;
  isPriority: boolean;
  onEdit: (g: Goal) => void;
  onContrib: (g: Goal) => void;
}) {
  const [simInput, setSimInput] = useState('');

  const cfg = colorCfg(goal.color);
  const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isCompleted = goal.status === 'completed';

  const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const statusKey = getStatus(progress);
  const sc = STATUS_CONFIG[statusKey];

  const simMonthly = parseFloat(simInput.replace(',', '.'));
  const simValid = simMonthly > 0 && remaining > 0;
  const simMonths = simValid ? Math.ceil(remaining / simMonthly) : null;

  return (
    <div className={`rounded-2xl p-5 border bg-slate-900 ${isPriority && !isCompleted ? 'border-red-500/40 shadow-[0_0_14px_rgba(239,68,68,0.22)]' : 'border-slate-800'}`}>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-white truncate">{goal.name}</p>
            {!isCompleted && <p className={`text-xs font-medium ${sc.cls}`}>{sc.label}</p>}
          </div>
        </div>
        <button onClick={() => onEdit(goal)}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-white transition-colors flex-shrink-0 ml-2"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Valor, percentual e barra */}
      <div className="flex items-end justify-between mb-2">
        <p className="text-sm text-slate-300">
          {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
        </p>
        <p className={`text-sm font-bold ${isCompleted ? 'text-green-400' : sc.cls}`}>
          {Math.round(pct)}%
        </p>
      </div>
      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${isCompleted ? 'bg-green-500' : sc.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Simulador */}
      {!isCompleted && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">R$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder="Quanto deseja aportar por mês?"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          {simInput !== '' && simMonths !== null && (
            <div className="mt-2">
              <p className="text-xs font-medium text-slate-400 mt-2">Simulação</p>
              <p className={`text-[13px] text-sm leading-snug break-words line-clamp-2 ${getSimulatorMessage(simMonths).cls}`}>
                R$ {simMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/mês → {simMonths} meses
              </p>
            </div>
          )}
        </div>
      )}

      {/* Botão de ação */}
      {!isCompleted ? (
        <button
          onClick={() => {
            if (simInput !== '') {
              console.log('aportar-agora', goal.name, simMonthly);
            } else {
              console.log('aportar-agora', goal.name);
            }
            onContrib(goal);
          }}
          className="mt-4 w-full py-2 rounded-xl bg-purple-600 text-white text-sm font-medium active:scale-95 transition-all"
        >
          {sc.btnLabel}
        </button>
      ) : (
        <div className="mt-4 w-full py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium text-center">
          🎉 Meta alcançada!
        </div>
      )}
    </div>
  );
}
