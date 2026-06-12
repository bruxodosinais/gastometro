import { formatCurrency } from '@/lib/calculations';

// Coach dos INSIGHTS in-app (Item 7). Estende o tom do M4 (lib/mission/coach.ts)
// pros insights gerais. Funções PURAS: recebem números JÁ computados +
// missionContext opcional e devolvem { emoji, message, cta? }. Nenhuma faz
// cálculo de negócio nem fetch — os componentes só renderizam o retorno.
//
// Regras de copy (voz TôOrganizado): humano, caloroso, ACIONÁVEL, sempre
// apontando pra guardar. COM Missão → fecha ligando à meta. SEM Missão →
// motivacional genérico + cta "Criar Missão". Missão 100%/cheia → NÃO dizer
// "guarde mais" (vira parabéns/neutro). Números sempre reais; nada fabricado.

export interface MissionContext {
  monthlyTarget: number;
  totalSaved: number;
  targetAmount: number;
}

export interface CoachCta {
  label: string;
  href: string;
}

export interface CoachOutput {
  emoji: string;
  message: string;
  cta?: CoachCta;
}

type MissionState = 'none' | 'open' | 'full';

function missionState(m: MissionContext | null | undefined): MissionState {
  if (!m) return 'none';
  if (m.targetAmount > 0 && m.totalSaved >= m.targetAmount) return 'full';
  return 'open';
}

const CTA_CRIAR: CoachCta = { label: 'Criar Missão', href: '/missao/nova' };
const CTA_VER: CoachCta = { label: 'Ver Missão', href: '/missao/dashboard' };

const fmt = (n: number) => formatCurrency(Math.round(n));

// ── Anomalia de gasto (AnomaliaCard) ────────────────────────────────────────
// Tem média → corte sugerido = voltar à média (economia = total − média).
export function coachAnomaly(args: {
  category: string;
  icon: string;
  total: number;
  average: number;
  percentChange: number;
  mission: MissionContext | null;
}): CoachOutput {
  const { category, icon, total, average, percentChange, mission } = args;
  const pct = Math.round(percentChange);
  const economia = Math.max(0, total - average);
  const head = `${category} tá ${pct}% acima da sua média esse mês.`;

  switch (missionState(mission)) {
    case 'open':
      return {
        emoji: icon,
        message: `${head} Voltar pra ~${fmt(average)} (sua média) libera ~${fmt(economia)} pra sua Missão. Bora?`,
      };
    case 'full':
      return {
        emoji: icon,
        message: `${head} Você já bateu sua meta — só vale ficar de olho pra não virar hábito.`,
      };
    default:
      return {
        emoji: icon,
        message: `${head} Voltar pro normal sobraria ~${fmt(economia)} — que tal transformar isso numa Missão?`,
        cta: CTA_CRIAR,
      };
  }
}

// ── Maior categoria do mês (InsightsCard) ───────────────────────────────────
// Sem média de baseline aqui → framing qualitativo, sem número fabricado.
export function coachTopCategory(args: {
  category: string;
  icon: string;
  total: number;
  mission: MissionContext | null;
}): CoachOutput {
  const { category, icon, total, mission } = args;
  const head = `${category} foi seu maior gasto: ${fmt(total)}.`;
  switch (missionState(mission)) {
    case 'open':
      return { emoji: icon, message: `${head} É onde mais dá pra sobrar pra sua Missão.` };
    case 'full':
      return { emoji: icon, message: head };
    default:
      return { emoji: icon, message: `${head} É onde mais dá pra economizar e começar a guardar.` };
  }
}

// ── Projeção de saldo do mês (InsightsCard) ─────────────────────────────────
export function coachProjection(args: {
  projectedLeftover: number; // income − gasto projetado (pode ser negativo)
  mission: MissionContext | null;
}): CoachOutput {
  const { projectedLeftover, mission } = args;
  const st = missionState(mission);

  if (projectedLeftover > 0) {
    if (st === 'open') {
      const pct =
        mission && mission.targetAmount > 0
          ? Math.round((projectedLeftover / mission.targetAmount) * 100)
          : 0;
      const tail = pct > 0 ? ` — daria pra guardar ${pct}% da sua meta` : '';
      return {
        emoji: '🚀',
        message: `No ritmo atual sobra ~${fmt(projectedLeftover)} esse mês${tail}. Continua assim!`,
      };
    }
    if (st === 'full') {
      return {
        emoji: '🚀',
        message: `No ritmo atual sobra ~${fmt(projectedLeftover)} esse mês — você já bateu a meta, que tal a próxima?`,
      };
    }
    return {
      emoji: '🚀',
      message: `No ritmo atual sobra ~${fmt(projectedLeftover)} esse mês — daria pra começar a guardar isso numa Missão.`,
      cta: CTA_CRIAR,
    };
  }

  // Vai faltar / empatar.
  const falta = Math.abs(projectedLeftover);
  if (st === 'open') {
    return {
      emoji: '⚠️',
      message: `No ritmo atual falta ~${fmt(falta)} pro fim do mês — segura os gastos pra não comer o aporte da Missão.`,
    };
  }
  return {
    emoji: '⚠️',
    message: `No ritmo atual vai faltar ~${fmt(falta)} no fim do mês. Bora segurar o ritmo.`,
  };
}

// ── Score do mês por % do orçamento usado (InsightsCard) ────────────────────
export function coachScore(args: {
  budgetPct: number;
  mission: MissionContext | null;
}): CoachOutput {
  const { budgetPct } = args;
  const open = missionState(args.mission) === 'open';

  if (budgetPct <= 50) {
    return {
      emoji: '🎯',
      message: open ? 'Ótimo controle! Sobra fôlego pro aporte da sua Missão.' : 'Ótimo controle! Continue assim.',
    };
  }
  if (budgetPct <= 80) {
    return {
      emoji: '👍',
      message: open ? 'Bom ritmo — dá pra manter o aporte da Missão.' : 'Bom ritmo. Fique de olho.',
    };
  }
  if (budgetPct <= 100) {
    return {
      emoji: '⚠️',
      message: open
        ? 'Tá apertado — segurar agora protege o aporte da sua Missão esse mês.'
        : 'Atenção com os gastos.',
    };
  }
  return {
    emoji: '🔴',
    message: open
      ? 'Orçamento estourado — priorize o essencial pra recuperar o aporte da Missão.'
      : 'Orçamento estourado.',
  };
}

// ── Taxa de poupança média (TipsSection · ruleLowSavings) ───────────────────
export function coachSavingsRate(args: {
  ratePct: number; // já em % (ex.: 6 = 6%); pode ser <= 0
  mission: MissionContext | null;
}): CoachOutput {
  const r = Math.round(args.ratePct);
  const st = missionState(args.mission);

  if (r <= 0) {
    if (st === 'open')
      return { emoji: '🐷', message: 'No período você gastou mais do que ganhou. Cada aporte na sua Missão ajuda a reequilibrar.', cta: CTA_VER };
    if (st === 'full')
      return { emoji: '🐷', message: 'No período você gastou mais do que ganhou — mas você já bateu sua meta. Hora de recuperar o fôlego.' };
    return { emoji: '🐷', message: 'No período você gastou mais do que ganhou. Uma Missão de Poupança ajuda a virar o jogo, um aporte de cada vez.', cta: CTA_CRIAR };
  }

  if (st === 'open')
    return { emoji: '🐷', message: `Você guarda ~${r}% da renda. Sua Missão te puxa pra cima — bora chegar nos 10–20%?`, cta: CTA_VER };
  if (st === 'full')
    return { emoji: '🐷', message: `Você guarda ~${r}% da renda e já bateu sua meta. Mandou bem!` };
  return { emoji: '🐷', message: `Você guarda ~${r}% da renda. O ideal é 10–20% — uma Missão ajuda a criar o hábito.`, cta: CTA_CRIAR };
}

// ── Margem livre do orçamento (OrcamentoCard) ───────────────────────────────
// freeMargin = renda − contas fixas − meta (o "orçamento livre planejado").
// > 0: sobra estrutural → bom aporte. <= 0: o plano não fecha → tom de ajuda.
export function coachBudget(args: {
  freeMargin: number;
  mission: MissionContext | null;
}): CoachOutput {
  const { freeMargin, mission } = args;
  const st = missionState(mission);

  // Margem ≈ 0 (renda cobre exatamente fixas + meta).
  if (Math.abs(freeMargin) < 1) {
    return {
      emoji: 'ℹ️',
      message: 'Sua renda cobre as contas fixas + a meta, sem margem livre esse mês.',
    };
  }

  if (freeMargin > 0) {
    switch (st) {
      case 'open':
        return {
          emoji: '✅',
          message: `Você tem ~${fmt(freeMargin)} livres esse mês depois das contas fixas — daria um bom aporte na sua Missão.`,
        };
      case 'full':
        return {
          emoji: '✅',
          message: `Você tem ~${fmt(freeMargin)} livres esse mês depois das contas fixas. Tá voando!`,
        };
      default:
        return {
          emoji: '✅',
          message: `Você tem ~${fmt(freeMargin)} livres esse mês depois das contas fixas — daria pra começar a guardar.`,
          cta: CTA_CRIAR,
        };
    }
  }

  // freeMargin < 0 → contas fixas + meta passam da renda.
  const overflow = -freeMargin;
  if (st === 'open' || st === 'full') {
    return {
      emoji: '⚠️',
      message: `Suas contas fixas + meta passam da renda em ~${fmt(overflow)}. Vale rever uma fixa ou ajustar a meta pra não apertar o aporte.`,
    };
  }
  return {
    emoji: '⚠️',
    message: `Suas contas fixas + meta passam da renda em ~${fmt(overflow)}. Vale rever uma fixa ou ajustar a meta pra não apertar o mês.`,
  };
}

// ── Gastos subindo 3 meses (TipsSection · ruleRisingSpend) ──────────────────
// Vem sob um título que já diz "3 meses" → a mensagem foca no detalhe + ação.
export function coachRisingSpend(args: {
  category: string | null;
  icon: string;
  percentChange: number;
  fromMonthLabel: string;
  mission: MissionContext | null;
}): CoachOutput {
  const { category, icon, percentChange, fromMonthLabel, mission } = args;
  const pct = Math.round(percentChange);
  const detail = category
    ? `O maior salto foi em ${icon} ${category} (+${pct}% desde ${fromMonthLabel}).`
    : `O aumento foi consistente no período.`;

  switch (missionState(mission)) {
    case 'open':
      return { emoji: '📈', message: `${detail} Frear agora protege o aporte da sua Missão.` };
    case 'full':
      return { emoji: '📈', message: `${detail} Vale revisar pra não perder o fôlego.` };
    default:
      return { emoji: '📈', message: `${detail} Frear agora sobra mais pra você guardar.` };
  }
}
