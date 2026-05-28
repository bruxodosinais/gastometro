'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import { getMonthlyBaseCost, type MonthlyBaseCost } from '@/lib/emergencyFund';
import { Goal, GoalContribution, GoalTerm, GoalType } from '@/lib/types';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradeBanner from '@/components/UpgradeBanner';
import LoadingButton from '@/components/ui/LoadingButton';
import CurrencyInput from '@/components/CurrencyInput';

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

const COLORS: ColorKey[] = ['violet', 'blue', 'green', 'amber', 'orange', 'cyan', 'rose', 'slate'];

const COLOR_CONFIG: Record<ColorKey, { bar: string; text: string; bg: string; border: string; dot: string }> = {
  violet:  { bar: 'bg-mint-500',  text: 'text-mint-500',  bg: 'bg-mint-50',  border: 'border-mint-500/20',  dot: 'bg-mint-500' },
  blue:    { bar: 'bg-blue-500',    text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
  green:   { bar: 'bg-mint',   text: 'text-mint-500',   bg: 'bg-mint-50',   border: 'border-green-500/20',   dot: 'bg-mint' },
  amber:   { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  orange:  { bar: 'bg-orange-500',  text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  dot: 'bg-orange-500' },
  cyan:    { bar: 'bg-cyan-500',    text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    dot: 'bg-cyan-500' },
  emerald: { bar: 'bg-mint', text: 'text-mint-500', bg: 'bg-mint-50', border: 'border-emerald-500/20', dot: 'bg-mint' },
  rose:    { bar: 'bg-rose-500',    text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    dot: 'bg-rose-500' },
  slate:   { bar: 'bg-slate-500',   text: 'text-gray-500',   bg: 'bg-gray-50',      border: 'border-gray-200',      dot: 'bg-slate-500' },
};

function colorCfg(color: string) {
  return COLOR_CONFIG[(color as ColorKey) in COLOR_CONFIG ? (color as ColorKey) : 'slate'];
}

// ─── Prazo (term) ─────────────────────────────────────────────────────────────

const TERM_OPTIONS: { value: GoalTerm; label: string; badge: string }[] = [
  { value: 'curto', label: 'Curto prazo', badge: 'bg-mint-50 text-mint-500 border-green-500/20' },
  { value: 'medio', label: 'Médio prazo', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
  { value: 'longo', label: 'Longo prazo', badge: 'bg-mint-50 text-mint-500 border-mint-500/20' },
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
  return { text: `Você conclui em ${meses} meses`,                       cls: 'text-mint-500' };
}

function formatDeadlineMonth(dateStr: string): string {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, m] = dateStr.split('-');
  return `${months[parseInt(m, 10) - 1]}/${y}`;
}

function formatFutureMonth(monthsFromNow: number): string {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow);
  return `${months[d.getMonth()]}/${d.getFullYear()}`;
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return formatCurrency(value);
}

function avgMonthlyContributions(contributions: GoalContribution[]): number {
  if (contributions.length === 0) return 0;
  const byMonth: Record<string, number> = {};
  contributions.forEach((c) => {
    const month = c.date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + c.amount;
  });
  const totals = Object.values(byMonth);
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

type StatusKey = 'no-prazo' | 'atencao' | 'atrasada' | 'sem-prazo';

function computeStatus(goal: Goal, avgMonthly: number): StatusKey {
  if (!goal.deadline) return 'sem-prazo';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(goal.deadline + 'T00:00:00');
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (deadline < today && remaining > 0) return 'atrasada';
  if (remaining <= 0) return 'no-prazo';
  const months = Math.max(1, monthsDiff(today, deadline));
  return avgMonthly >= remaining / months ? 'no-prazo' : 'atencao';
}

const STATUS_CONFIG: Record<StatusKey, { label: string; cls: string; btnLabel: string }> = {
  'no-prazo':  { label: '🟢 No prazo',  cls: 'text-mint-500',   btnLabel: 'Manter plano' },
  'atencao':   { label: '🟡 Atenção',   cls: 'text-yellow-400', btnLabel: 'Aumentar aporte' },
  'atrasada':  { label: '🔴 Atrasada',  cls: 'text-red-400',    btnLabel: 'Aportar agora' },
  'sem-prazo': { label: '⚪ Sem prazo', cls: 'text-gray-400',   btnLabel: 'Aportar' },
};

// ─── Componente principal ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  type: 'personalizada' as GoalType,
  targetAmount: 0,
  currentAmount: 0,
  deadline: '',
  color: 'slate' as ColorKey,
  term: '' as '' | GoalTerm,
  emoji: '',
};

const TODAY = new Date().toISOString().slice(0, 10);

// ─── Reserva de Emergência ───────────────────────────────────────────────────

type Multiplier = 3 | 6 | 12;
const MULTIPLIERS: Multiplier[] = [3, 6, 12];
// Tolerância de 5% pra detectar qual pill um targetAmount herdado da URL
// corresponde. Ex.: monthlyBase=833.33 e sugestao=5000 → ratio=6.0006, dentro
// de 5% de 6 → pre-seleciona pill 6x.
const MULTIPLIER_TOLERANCE = 0.05;

// Nomes considerados "genéricos" pra reserva — quando o usuário não nomeou a
// meta com algo específico, exibimos o badge "🛡️ Reserva de Emergência" no
// lugar pra deixar claro o propósito (vem geralmente da Home → URL prefill).
const GENERIC_RESERVA_NAMES = new Set([
  'reserva',
  'reserva de emergência',
  'reserva de emergencia',
  'reserva emergência',
  'reserva emergencia',
]);
function isGenericReservaName(name: string): boolean {
  return GENERIC_RESERVA_NAMES.has(name.trim().toLowerCase());
}

export default function MetasPage() {
  const subscription = useSubscription();
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
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Reserva de Emergência — só carregam quando form.type === 'reserva'
  const [monthlyBase, setMonthlyBase] = useState<MonthlyBaseCost | null>(null);
  const [monthlyBaseLoading, setMonthlyBaseLoading] = useState(false);
  const [selectedMultiplier, setSelectedMultiplier] = useState<Multiplier | null>(null);

  // Contribuição
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);
  const [contribAmount, setContribAmount] = useState(0);
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

  // Lazy-fetch do custo mensal base na 1ª vez que o user seleciona 'reserva'.
  // O resultado fica em state e é reaproveitado se o user trocar de tipo e
  // voltar pra reserva no mesmo modal.
  useEffect(() => {
    if (form.type !== 'reserva') return;
    if (monthlyBase !== null || monthlyBaseLoading) return;
    setMonthlyBaseLoading(true);
    getMonthlyBaseCost()
      .then((r) => setMonthlyBase(r))
      .catch((err) => console.error('getMonthlyBaseCost:', err))
      .finally(() => setMonthlyBaseLoading(false));
  }, [form.type, monthlyBase, monthlyBaseLoading]);

  // Detecta qual pill (3/6/12) o targetAmount corrente corresponde — usado
  // quando o user chega via URL com sugestao=X e o monthlyBase carrega depois,
  // pra pre-selecionar a pill certa sem o user clicar.
  useEffect(() => {
    if (!monthlyBase || monthlyBase.monthlyBase <= 0) return;
    if (selectedMultiplier !== null) return;
    const target = form.targetAmount;
    if (!target || !Number.isFinite(target)) return;
    const ratio = target / monthlyBase.monthlyBase;
    const match = MULTIPLIERS.find((m) => Math.abs(ratio - m) <= m * MULTIPLIER_TOLERANCE);
    if (match) setSelectedMultiplier(match);
  }, [monthlyBase, form.targetAmount, selectedMultiplier]);

  function pickMultiplier(m: Multiplier) {
    if (!monthlyBase || monthlyBase.monthlyBase <= 0) return;
    const value = monthlyBase.monthlyBase * m;
    setForm((f) => ({ ...f, targetAmount: value }));
    setSelectedMultiplier(m);
  }

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
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
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
    setShowAllTypes(false);
    setSelectedMultiplier(null);
  }

  function handleTypeChange(type: GoalType) {
    setForm((f) => ({ ...f, type, color: GOAL_TYPES[type].color }));
  }

  async function handleSave() {
    setFormError(null);
    const target = form.targetAmount;
    const current = form.currentAmount || 0;

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
    setContribAmount(0);
    setContribDate(TODAY);
    setContribNote('');
    setContribError(null);
  }

  async function handleContrib() {
    if (!contributingGoal) return;
    setContribError(null);
    const amount = contribAmount;
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
        <div className="w-8 h-8 rounded-full border-2 border-mint-500 border-t-transparent animate-spin" />
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

  const statusPriority: Record<StatusKey, number> = { atrasada: 0, atencao: 1, 'no-prazo': 2, 'sem-prazo': 3 };
  const sortedActiveGoals = [...activeGoals].sort((a, b) => {
    const avgA = avgMonthlyContributions(contribsByGoal[a.id] ?? []);
    const avgB = avgMonthlyContributions(contribsByGoal[b.id] ?? []);
    const statusDiff = statusPriority[computeStatus(a, avgA)] - statusPriority[computeStatus(b, avgB)];
    if (statusDiff !== 0) return statusDiff;
    const progA = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
    const progB = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
    return progB - progA;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!subscription.loading && subscription.isFree) {
    return (
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
        <UpgradeBanner
          variant="fullpage"
          feature="metas"
          message="Metas financeiras são exclusivas do plano Pro. Desbloqueie reservas, viagens, imóveis e muito mais."
        />
      </main>
    );
  }

  return (
    <>
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Metas</h1>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>Construindo patrimônio</p>
          </div>
          {!showForm && (
            <button
              onClick={openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 20, border: 'none', padding: '6px 14px', cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation' }}
            >
              <Plus size={14} /> Nova meta
            </button>
          )}
        </div>

        {/* Cards de resumo */}
        {goals.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 14, boxShadow: 'var(--card-shadow)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>TOTAL GUARDADO</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatCompactCurrency(totalSaved)}</p>
            </div>
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 14, boxShadow: 'var(--card-shadow)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>METAS ATIVAS</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{activeGoals.length}</p>
            </div>
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 14, boxShadow: 'var(--card-shadow)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>PRÓXIMA</p>
              {nextGoal ? (
                <>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextGoal.name}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginTop: 2 }}>
                    {Math.round((nextGoal.currentAmount / nextGoal.targetAmount) * 100)}%
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>—</p>
              )}
            </div>
          </div>
        )}

        {/* Formulário de criação / edição */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
          >
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 2rem)',
              maxWidth: '32rem',
              maxHeight: '90vh',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: 24,
              boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {editingId ? 'Editar meta' : 'Nova meta'}
              </p>
              <button
                type="button"
                onClick={closeForm}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={15} color="var(--text-2)" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">Nome da meta</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Viagem Europa, Reserva de emergência…"
                  autoFocus
                  style={{ fontSize: '16px' }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                />
              </div>
              {/* Valores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">Valor alvo (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <CurrencyInput value={form.targetAmount}
                      onChange={(v) => setForm((f) => ({ ...f, targetAmount: v }))}
                      placeholder="0,00"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 text-base font-semibold placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">Já tenho (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <CurrencyInput value={form.currentAmount}
                      onChange={(v) => setForm((f) => ({ ...f, currentAmount: v }))}
                      placeholder="0,00"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 text-base font-semibold placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
              {/* Configurações avançadas */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-xs font-medium transition-colors"
              >
                {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Configurações avançadas
              </button>
              {showAdvanced && (
                <>
                  {/* Tipo */}
                  <div>
                    <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">Tipo</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(Object.keys(GOAL_TYPES) as GoalType[])
                        .filter((_, i) => showAllTypes || i < 3)
                        .map((t) => {
                          const cfg = GOAL_TYPES[t];
                          const active = form.type === t;
                          return (
                            <button key={t} type="button" onClick={() => handleTypeChange(t)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                                active ? 'bg-mint-50 border-mint-500/40 text-gray-900'
                                       : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-slate-600 hover:text-gray-700'
                              }`}
                            >
                              <span>{cfg.icon}</span>
                              <span className="text-xs font-medium truncate">{cfg.label}</span>
                            </button>
                          );
                        })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllTypes((v) => !v)}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showAllTypes ? '− Ver menos' : '+ Ver mais tipos'}
                    </button>
                  </div>
                  {/* Calculador de Reserva + dica — só quando type='reserva'.
                      Calculador some se source='none' (sem dados); dica sempre
                      aparece pra apontar usuário pro fluxo Missão de Poupança. */}
                  {form.type === 'reserva' && (
                    <>
                  {(monthlyBaseLoading || (monthlyBase && monthlyBase.source !== 'none')) && (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 'var(--r-sm)',
                        background: 'rgba(91,91,214,0.06)',
                        border: '1px solid rgba(91,91,214,0.20)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 14 }}>🛡️</span>
                        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                          Calcular valor sugerido
                        </p>
                        {monthlyBaseLoading && (
                          <Loader2 size={12} className="animate-spin" color="var(--text-3)" />
                        )}
                      </div>

                      {!monthlyBaseLoading && monthlyBase && (
                        <>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {MULTIPLIERS.map((m) => {
                              const value = monthlyBase.monthlyBase * m;
                              const active = selectedMultiplier === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => pickMultiplier(m)}
                                  style={{
                                    flex: 1,
                                    padding: '8px 6px',
                                    borderRadius: 'var(--r-sm)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    border: active ? '1.5px solid #5B5BD6' : '1px solid var(--border)',
                                    background: active ? 'rgba(91,91,214,0.10)' : 'var(--bg)',
                                    color: active ? '#5B5BD6' : 'var(--text-2)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 2,
                                    touchAction: 'manipulation',
                                  }}
                                >
                                  <span style={{ fontSize: 11, fontWeight: 800 }}>
                                    {m}x{active ? ' ✓' : ''}
                                  </span>
                                  <span style={{ fontSize: 11 }}>
                                    {formatCurrency(value)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <p
                            style={{
                              fontSize: 11,
                              color: 'var(--text-3)',
                              marginTop: 8,
                              marginBottom: 0,
                            }}
                          >
                            Baseado em {formatCurrency(monthlyBase.monthlyBase)}/mês em{' '}
                            {monthlyBase.source === 'recurring'
                              ? 'despesas recorrentes'
                              : 'média dos últimos 3 meses'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {/* Dica: Missão de Poupança é o caminho recomendado pra
                      reserva (gamificação + desafios). Não bloqueia o fluxo. */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      background: '#F5F3FF',
                      border: '1px solid #DDD6FE',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1, marginTop: 1 }}>💡</span>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                      Para reserva de emergência, a Missão de Poupança oferece
                      acompanhamento mensal com desafios e conquistas.{' '}
                      <Link
                        href="/missao"
                        style={{ color: '#5B5BD6', fontWeight: 700, textDecoration: 'none' }}
                      >
                        Conhecer Missão →
                      </Link>
                    </p>
                  </div>
                    </>
                  )}
                  {/* Emoji personalizado */}
                  <div>
                    <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Emoji da meta{' '}
                      <span className="normal-case text-gray-500">(opcional — substitui o ícone de categoria)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(true)}
                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
                      >
                        {form.emoji ? (
                          <span className="text-2xl leading-none">{form.emoji}</span>
                        ) : (
                          <span className="text-gray-500">Escolher emoji</span>
                        )}
                      </button>
                      {form.emoji && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, emoji: '' }))}
                          className="text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          ✕ Remover
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Prazo e cor */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">Prazo (opcional)</label>
                      <input type="date" value={form.deadline}
                        onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                        style={{ fontSize: '16px' }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-mint-500 transition-colors [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">Cor</label>
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
                    <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                      Classificação de prazo <span className="normal-case text-gray-500">(opcional)</span>
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
                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-slate-600 hover:text-gray-700'
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
              <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px', marginTop: 14 }}>{formError}</p>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <LoadingButton onClick={handleSave} loading={saving} disabled={!form.name.trim() || !form.targetAmount}
                style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--r-sm)', background: 'var(--accent)', border: 'none', fontSize: 14, fontWeight: 800, color: 'white', cursor: 'pointer', opacity: (saving || !form.name.trim() || !form.targetAmount) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, touchAction: 'manipulation' }}
              >
                <><Check size={16} /> {editingId ? 'Salvar' : 'Criar meta'}</>
              </LoadingButton>
              {editingId && (
                <button onClick={() => handleDelete(editingId)} disabled={deletingId === editingId}
                  style={{ padding: '14px 16px', borderRadius: 'var(--r-sm)', background: 'var(--red-bg)', border: '1.5px solid var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {deletingId === editingId ? <Loader2 size={16} color="var(--red)" className="animate-spin" /> : <Trash2 size={16} color="var(--red)" />}
                </button>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Estado vazio */}
        {goals.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <Target size={48} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Nenhuma meta criada ainda.</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginBottom: 20, maxWidth: 280, margin: '0 auto 20px' }}>
              Crie sua primeira meta e comece a construir seu patrimônio.
            </p>
            <button
              onClick={openCreate}
              style={{ background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, borderRadius: 'var(--r-sm)', border: 'none', padding: '10px 20px', cursor: 'pointer', touchAction: 'manipulation' }}
            >
              Criar primeira meta
            </button>
          </div>
        )}

        {/* Metas ativas */}
        {activeGoals.length > 0 && (
          <>
            {completedGoals.length > 0 && (
              <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Ativas</h2>
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
              <Trophy size={13} className="text-mint-500" />
              <h2 className="text-mint-500 text-xs font-semibold uppercase tracking-wider">Vitórias</h2>
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
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setContributingGoal(null); }}
        >
          <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '20px 20px 0 0', padding: 24 }} className="md:rounded-2xl">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-bg)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {goalIcon(contributingGoal)}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{contributingGoal.name}</p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginTop: 2 }}>
                    {formatCurrency(contributingGoal.currentAmount)} / {formatCurrency(contributingGoal.targetAmount)}
                  </p>
                </div>
              </div>
              <button onClick={() => setContributingGoal(null)}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={15} color="var(--text-2)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Valor (R$)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-3)' }}>R$</span>
                  <CurrencyInput value={contribAmount}
                    onChange={setContribAmount}
                    placeholder="0,00" autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px 12px 42px', fontSize: 16, fontWeight: 700, color: 'var(--text)', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Data</label>
                <input type="date" value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px', fontSize: 16, color: 'var(--text)', outline: 'none', colorScheme: 'light' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Observação (opcional)</label>
                <input type="text" value={contribNote}
                  onChange={(e) => setContribNote(e.target.value)}
                  placeholder="Ex: salário de abril, bônus…"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px', fontSize: 16, color: 'var(--text)', outline: 'none' }}
                />
              </div>
            </div>

            {contribError && (
              <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px', marginTop: 12 }}>{contribError}</p>
            )}

            <button onClick={handleContrib} disabled={contribSaving || !contribAmount}
              style={{ width: '100%', marginTop: 16, padding: '14px 0', borderRadius: 'var(--r-sm)', background: 'var(--accent)', border: 'none', fontSize: 14, fontWeight: 800, color: 'white', cursor: 'pointer', opacity: (contribSaving || !contribAmount) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, touchAction: 'manipulation' }}
            >
              {contribSaving ? <Loader2 size={16} className="animate-spin" /> : <><TrendingUp size={16} /> Registrar aporte</>}
            </button>
          </div>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowEmojiPicker(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', width: '90%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.16)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Escolher emoji</h3>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={16} color="var(--text-2)" />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setForm((f) => ({ ...f, emoji: e })); setShowEmojiPicker(false); }}
                    style={{
                      height: 40, borderRadius: 'var(--r-sm)', fontSize: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1.5px solid ${form.emoji === e ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.emoji === e ? 'var(--accent-bg)' : 'var(--bg)',
                      cursor: 'pointer',
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
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
        className="absolute inset-0 backdrop-blur-sm flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onDone}
      >
        <div
          className="celebrate-card pointer-events-auto"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 24, padding: '32px 40px', textAlign: 'center', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }} className="animate-bounce">{icon}</div>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Meta concluída!</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>{goal.name}</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)' }}>{formatCurrency(goal.currentAmount)} guardados</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16 }}>Clique para continuar</p>
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
    <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ padding: 20 }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--green-bg)', border: '1.5px solid rgba(0,195,122,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginTop: 2 }}>
                🏆 Concluída em {formatShortDate(completionDate)}
              </p>
              {goal.term && (
                <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, border: '1px solid rgba(0,195,122,0.25)', background: 'var(--green-bg)', color: 'var(--green)', marginTop: 4 }}>
                  {termBadge(goal.term).label.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => onEdit(goal)}
            style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
          >
            <Pencil size={12} color="var(--text-2)" />
          </button>
        </div>

        {/* Valor */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)', margin: 0 }}>{formatCurrency(goal.currentAmount)}</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginTop: 2 }}>guardados de {formatCurrency(goal.targetAmount)}</p>
        </div>

        {/* Barra completa */}
        <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 14, background: 'var(--green-bg)' }}>
          <div style={{ height: '100%', width: '100%', borderRadius: 3, background: 'var(--green)' }} />
        </div>

        {/* Botão "Ver conquista" */}
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 'var(--r-sm)', background: 'var(--green-bg)', border: '1.5px solid rgba(0,195,122,0.2)', fontSize: 12, fontWeight: 700, color: 'var(--green)', cursor: 'pointer' }}
        >
          <Trophy size={13} />
          {expanded ? 'Ocultar conquista' : 'Ver conquista'}
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {/* Timeline expandida */}
        {expanded && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            {timeline.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>Nenhum aporte registrado.</p>
            ) : (
              <>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Linha do tempo</p>
                <div>
                  {timeline.map((c, idx) => {
                    const isLast = idx === timeline.length - 1;
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        {/* Conector */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2, width: 12, flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${isLast ? 'var(--green)' : 'var(--border)'}`, background: isLast ? 'var(--green)' : 'var(--surface)' }} />
                          {!isLast && <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 20, marginTop: 2 }} />}
                        </div>
                        {/* Conteúdo */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 10 }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: isLast ? 'var(--green)' : 'var(--text-2)', margin: 0 }}>
                              {formatShortDate(c.date)}{isLast ? ' ✓' : ''}
                            </p>
                            {c.note && (
                              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{c.note}</p>
                            )}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 8, color: isLast ? 'var(--green)' : 'var(--text)' }}>
                            +{formatCurrency(c.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Total */}
                <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeline.length} {timeline.length === 1 ? 'aporte' : 'aportes'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
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
  const [simInput, setSimInput] = useState(0);

  const cfg = colorCfg(goal.color);
  const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isCompleted = goal.status === 'completed';
  const isReserva = goal.type === 'reserva';
  const displayName =
    isReserva && isGenericReservaName(goal.name) ? '🛡️ Reserva de Emergência' : goal.name;

  const avgContrib = avgMonthlyContributions(contributions);
  const statusKey = computeStatus(goal, avgContrib);
  const sc = STATUS_CONFIG[statusKey];

  const simMonthly = simInput;
  const simValid = simMonthly > 0 && remaining > 0;
  const simMonths = simValid ? Math.ceil(remaining / simMonthly) : null;

  const projectedMonths = avgContrib > 0 && remaining > 0 ? Math.ceil(remaining / avgContrib) : null;

  // Aporte necessário para bater o prazo (exibido sempre que há prazo futuro)
  const mesesRestantes = goal.deadline
    ? Math.max(1, monthsDiff(new Date(), new Date(goal.deadline + 'T00:00:00')))
    : null;
  const requiredMonthly = mesesRestantes !== null && remaining > 0 && statusKey !== 'atrasada'
    ? remaining / mesesRestantes
    : null;

  const cardBorderColor = isPriority && !isCompleted && statusKey === 'atrasada'
    ? 'var(--red)'
    : isPriority && !isCompleted && statusKey === 'atencao'
    ? 'var(--yellow)'
    : 'var(--border)';

  const barColor = isCompleted
    ? 'var(--green)'
    : statusKey === 'atrasada'
    ? 'var(--red)'
    : statusKey === 'atencao'
    ? '#f59e0b'
    : 'var(--accent)';

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1.5px solid ${cardBorderColor}`,
      borderRadius: 'var(--r)',
      padding: '16px 18px',
      boxShadow: 'var(--card-shadow)',
      ...(isReserva && { borderLeft: '3px solid #5B5BD6' }),
    }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--logo-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
            {!isCompleted && (
              <p style={{ fontSize: 11, fontWeight: 700, color: statusKey === 'atrasada' ? 'var(--red)' : statusKey === 'atencao' ? '#f59e0b' : 'var(--green)', marginTop: 2 }}>
                {sc.label}
              </p>
            )}
            {!isCompleted && requiredMonthly !== null && (
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginTop: 2 }}>
                {formatCurrency(requiredMonthly)}/mês para chegar até {formatDeadlineMonth(goal.deadline!)}
              </p>
            )}
            {!isCompleted && projectedMonths !== null && (
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginTop: 2 }}>
                No ritmo atual, você chega em {formatFutureMonth(projectedMonths)}
              </p>
            )}
          </div>
        </div>
        <button onClick={() => onEdit(goal)} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
          <Pencil size={13} color="var(--text-3)" />
        </button>
      </div>

      {/* Progresso */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
          {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
          {Math.round(pct)}%
        </p>
      </div>
      <div style={{ height: 6, background: 'var(--accent-bg)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: barColor, transition: 'width 300ms ease-out' }} />
      </div>

      {/* Simulador */}
      {!isCompleted && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-2)' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-3)' }}>R$</span>
            <CurrencyInput
              value={simInput}
              onChange={setSimInput}
              placeholder="Quanto deseja aportar por mês?"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', paddingLeft: 32, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: 'var(--text)', outline: 'none' }}
            />
          </div>
          {simInput > 0 && simMonths !== null && (
            <p style={{ fontSize: 12, fontWeight: 500, color: getSimulatorMessage(simMonths).cls === 'text-mint-500' ? 'var(--green)' : getSimulatorMessage(simMonths).cls === 'text-red-400' ? 'var(--red)' : '#f59e0b', marginTop: 8 }}>
              {getSimulatorMessage(simMonths).text}
            </p>
          )}
        </div>
      )}

      {/* Botão de ação */}
      {!isCompleted ? (
        <button
          onClick={() => { onContrib(goal); }}
          style={{ marginTop: 14, width: '100%', padding: '12px 0', borderRadius: 'var(--r-sm)', background: 'var(--accent)', border: 'none', fontSize: 14, fontWeight: 800, color: 'white', cursor: 'pointer', touchAction: 'manipulation' }}
        >
          {sc.btnLabel}
        </button>
      ) : (
        <div style={{ marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 'var(--r-sm)', background: 'var(--green-bg)', border: '1px solid rgba(0,195,122,0.2)', fontSize: 13, fontWeight: 700, color: 'var(--green)', textAlign: 'center' }}>
          🎉 Meta alcançada!
        </div>
      )}
    </div>
  );
}
