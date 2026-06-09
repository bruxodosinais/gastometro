import { formatCurrency } from '@/lib/calculations';

// Coach da Missão (M4): transforma o estado cru da meta em uma mensagem
// motivacional ligada ao OBJETIVO (guardar). É só copy/derivação — NÃO toca em
// moeda, streak, banco nem escreve nada. Usado no MissaoCard (Home, "check-in"
// diário) e no dashboard. Toda a matemática é defensiva (sem NaN/Infinity).

export type CoachTone = 'welcome' | 'ahead' | 'onTrack' | 'behind' | 'done' | 'paused';

export interface MissionCoachState {
  totalSaved: number;
  target: number;
  startDate: string; // YYYY-MM-DD
  targetDate: string; // YYYY-MM-DD
  monthlyTarget: number;
  status: 'active' | 'completed' | 'paused';
}

export interface MissionCoach {
  tone: CoachTone;
  message: string;
  dayOfMission: number; // Dia 1 = start_date
}

// Parse de YYYY-MM-DD em data LOCAL ao meio-dia (evita off-by-one de fuso, mesma
// lição do resto do app). Datas inválidas caem em "hoje".
function parseLocal(d: string): Date {
  const [y, m, dd] = (d ?? '').split('-').map(Number);
  if (!y || !m || !dd) return startOfToday();
  return new Date(y, m - 1, dd);
}

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function getMissionCoach(state: MissionCoachState): MissionCoach {
  const { totalSaved, target, monthlyTarget, status } = state;
  const today = startOfToday();
  const start = parseLocal(state.startDate);
  const targetDate = parseLocal(state.targetDate);

  const elapsedDays = Math.max(0, daysBetween(start, today));
  const dayOfMission = elapsedDays + 1; // Dia 1 no start_date

  const savedPct = target > 0 ? totalSaved / target : 0;
  const remaining = Math.max(0, target - totalSaved);

  // ── Estados terminais ──────────────────────────────────────────────────
  if (status === 'completed' || savedPct >= 1) {
    return {
      tone: 'done',
      dayOfMission,
      message: '🏆 Meta batida! Você guardou tudo. Bora começar a próxima?',
    };
  }
  if (status === 'paused') {
    return {
      tone: 'paused',
      dayOfMission,
      message: '⏸️ Missão pausada. Quando quiser, é só retomar de onde parou.',
    };
  }

  // ── Recém-criada / Dia 1 ────────────────────────────────────────────────
  if (dayOfMission <= 1 && totalSaved <= 0) {
    const msg =
      monthlyTarget > 0
        ? `🎯 Missão começou! Meta de ${formatCurrency(target)}. Bora guardar os primeiros ${formatCurrency(monthlyTarget)}?`
        : `🎯 Missão começou! Meta de ${formatCurrency(target)}. Todo aporte conta — bora começar?`;
    return { tone: 'welcome', dayOfMission, message: msg };
  }

  // ── Ritmo: poupança% vs tempo decorrido% ────────────────────────────────
  const totalDuration = Math.max(0, daysBetween(start, targetDate));
  const timePct = totalDuration > 0 ? clamp01(elapsedDays / totalDuration) : 0;
  const expectedByNow = timePct * target;
  const MARGIN = 0.05;

  // ADIANTADO
  if (savedPct >= timePct + MARGIN) {
    const daysToTarget = daysBetween(today, targetDate);
    const monthsToTarget = daysToTarget / 30.44;
    const monthsToFinishAtRate = monthlyTarget > 0 ? remaining / monthlyTarget : null;
    const aheadMonths =
      monthsToFinishAtRate != null ? Math.round(monthsToTarget - monthsToFinishAtRate) : 0;
    const aheadTail =
      aheadMonths >= 1
        ? ` No ritmo atual você termina ~${aheadMonths} ${aheadMonths === 1 ? 'mês' : 'meses'} antes do previsto.`
        : '';
    return {
      tone: 'ahead',
      dayOfMission,
      message: `🚀 Você está adiantado! Já guardou ${formatCurrency(totalSaved)}.${aheadTail} Continua firme!`,
    };
  }

  // NO RITMO
  if (savedPct >= timePct - MARGIN) {
    return {
      tone: 'onTrack',
      dayOfMission,
      message: `✅ No ritmo certo: ${formatCurrency(totalSaved)} guardados, faltam ${formatCurrency(remaining)}. Continua firme!`,
    };
  }

  // ATRASADO — sugere o aporte que recoloca no ritmo (o que faltou acumular).
  const shortfall = Math.max(0, expectedByNow - totalSaved);
  const suggested = shortfall > 0 ? shortfall : monthlyTarget;
  return {
    tone: 'behind',
    dayOfMission,
    message:
      suggested > 0
        ? `💪 Um aporte de ~${formatCurrency(suggested)} esse mês te recoloca no ritmo da meta.`
        : `💪 Bora retomar o ritmo? Faltam ${formatCurrency(remaining)} pra sua meta.`,
  };
}
