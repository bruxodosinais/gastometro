// Fonte de verdade dos badges (visual + categorização). As chaves abaixo
// batem 1:1 com `badge_key` na tabela mission_badges (UNIQUE) e com a lógica
// de checkAndUnlockBadges em lib/storage/missions.ts. Os 6 primeiros existem
// desde o lançamento; os 10 abaixo entraram com a expansão de gamificação.

export type BadgeCategory = 'streak' | 'valor' | 'missoes' | 'comportamento';

export interface BadgeDefinition {
  key: string;
  emoji: string;
  name: string;
  description: string;
  category: BadgeCategory;
}

export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  // ─── Comportamento (legados + novos) ──────────────────────────────────
  primeiro_passo: {
    key: 'primeiro_passo',
    emoji: '🚀',
    name: 'Primeiro passo',
    description: 'Você fez seu primeiro depósito. O começo é sempre o passo mais difícil.',
    category: 'comportamento',
  },
  largada_rapida: {
    key: 'largada_rapida',
    emoji: '⚡',
    name: 'Largada rápida',
    description: 'Primeiro depósito feito na primeira semana da missão. Pegou no tranco.',
    category: 'comportamento',
  },
  pontual: {
    key: 'pontual',
    emoji: '📅',
    name: 'Pontual',
    description: 'Você não pulou nenhum mês desde o início da missão. Disciplina pura.',
    category: 'comportamento',
  },
  dobrou_meta: {
    key: 'dobrou_meta',
    emoji: '💥',
    name: 'Dobrou a meta',
    description: 'Em um único mês você guardou pelo menos o dobro da meta mensal.',
    category: 'comportamento',
  },

  // ─── Streak ───────────────────────────────────────────────────────────
  consistente: {
    key: 'consistente',
    emoji: '🔥',
    name: 'Consistente',
    description: 'Três meses seguidos guardando — é assim que se constrói o hábito.',
    category: 'streak',
  },
  em_chama: {
    key: 'em_chama',
    emoji: '🔥',
    name: 'Em chamas',
    description: 'Três meses consecutivos com aporte. Mantém o ritmo!',
    category: 'streak',
  },
  expert: {
    key: 'expert',
    emoji: '💎',
    name: 'Poupador Expert',
    description: 'Seis meses seguidos. Você virou um poupador de elite.',
    category: 'streak',
  },
  inabalavel: {
    key: 'inabalavel',
    emoji: '🛡️',
    name: 'Inabalável',
    description: 'Seis meses consecutivos. Nada te tira do caminho.',
    category: 'streak',
  },
  lendario: {
    key: 'lendario',
    emoji: '🌟',
    name: 'Lendário',
    description: 'Doze meses consecutivos guardando. Você é referência.',
    category: 'streak',
  },

  // ─── Valor acumulado (cross-missão) ───────────────────────────────────
  poupador_iniciante: {
    key: 'poupador_iniciante',
    emoji: '🪙',
    name: 'Poupador iniciante',
    description: 'R$ 1.000 acumulados somando todas as suas missões.',
    category: 'valor',
  },
  poupador_dedicado: {
    key: 'poupador_dedicado',
    emoji: '💰',
    name: 'Poupador dedicado',
    description: 'R$ 5.000 acumulados ao longo de todas as suas missões.',
    category: 'valor',
  },
  poupador_elite: {
    key: 'poupador_elite',
    emoji: '🏦',
    name: 'Poupador de elite',
    description: 'R$ 50.000 acumulados. Você está em outro patamar.',
    category: 'valor',
  },

  // ─── Missões ──────────────────────────────────────────────────────────
  meio_caminho: {
    key: 'meio_caminho',
    emoji: '🏆',
    name: 'Meio caminho',
    description: 'Metade do alvo já é seu. Daqui pra frente é só descer a ladeira.',
    category: 'missoes',
  },
  meta_batida: {
    key: 'meta_batida',
    emoji: '🎯',
    name: 'Meta batida',
    description: 'Missão cumprida! O dinheiro que você guardou agora é só seu.',
    category: 'missoes',
  },
  mestre_clt: {
    key: 'mestre_clt',
    emoji: '👑',
    name: 'Mestre CLT',
    description: 'Duas missões concluídas. Você não para mais.',
    category: 'missoes',
  },
  recorrente: {
    key: 'recorrente',
    emoji: '🔁',
    name: 'Recorrente',
    description: 'Três missões concluídas. Poupar virou rotina.',
    category: 'missoes',
  },
  serial_saver: {
    key: 'serial_saver',
    emoji: '🏅',
    name: 'Serial saver',
    description: 'Cinco missões concluídas. Você coleciona conquistas.',
    category: 'missoes',
  },
};

// Ordem de progressão usada pelas grids de badge e pelo cálculo do "próximo
// badge". Não-alfabética: do mais fácil ao mais difícil dentro de cada eixo.
export const BADGE_ORDER: readonly string[] = [
  'primeiro_passo',
  'largada_rapida',
  'consistente',
  'em_chama',
  'meio_caminho',
  'dobrou_meta',
  'pontual',
  'expert',
  'inabalavel',
  'poupador_iniciante',
  'poupador_dedicado',
  'meta_batida',
  'mestre_clt',
  'recorrente',
  'serial_saver',
  'lendario',
  'poupador_elite',
];

export function getBadgeDefinition(key: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS[key];
}

// ─── Sistema de níveis por progresso da missão ──────────────────────────
// Usado no header do dashboard (chip) e na página de badges (card de XP).
// Faixas em 5 níveis: 0-24, 25-49, 50-74, 75-99, 100.

export interface MissionLevel {
  emoji: string;
  label: string;
  /** Faixa inferior (inclusive). */
  min: number;
  /** Faixa superior (exclusive, exceto no último). */
  max: number;
  next: { emoji: string; label: string } | null;
  /** % do progresso dentro do nível atual (0–100). */
  progressInLevel: number;
  /** % faltando para o próximo nível (arredondado). 0 quando já está no topo. */
  toNextPercent: number;
}

const LEVELS: { emoji: string; label: string; min: number; max: number }[] = [
  { emoji: '🌱', label: 'Iniciante',     min: 0,   max: 25 },
  { emoji: '⚡', label: 'Intermediário', min: 25,  max: 50 },
  { emoji: '💎', label: 'Avançado',      min: 50,  max: 75 },
  { emoji: '🚀', label: 'Expert',        min: 75,  max: 100 },
  { emoji: '🏆', label: 'Completo',      min: 100, max: 100 },
];

export function getMissionLevel(progressPercent: number): MissionLevel {
  const pct = Math.max(0, Math.min(100, progressPercent));
  // Topo: 100% cai no nível Completo. Os demais usam [min, max) — uma missão
  // a 25% sobe pro Intermediário, não fica no fim do Iniciante.
  let idx = LEVELS.findIndex((l, i) => i === LEVELS.length - 1 ? pct >= l.min : pct >= l.min && pct < l.max);
  if (idx < 0) idx = 0;
  const current = LEVELS[idx];
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;

  const span = current.max - current.min;
  const progressInLevel = span > 0 ? Math.max(0, Math.min(100, ((pct - current.min) / span) * 100)) : 100;
  const toNextPercent = next ? Math.max(0, Math.ceil(next.min - pct)) : 0;

  return {
    emoji: current.emoji,
    label: current.label,
    min: current.min,
    max: current.max,
    next: next ? { emoji: next.emoji, label: next.label } : null,
    progressInLevel,
    toNextPercent,
  };
}
