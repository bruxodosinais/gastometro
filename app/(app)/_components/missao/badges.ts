// Definições centralizadas dos badges. Dashboard usa para checar/desbloquear
// após cada aporte; página /missao/badges usa para renderizar a grid.
// Chaves usadas como `badge_key` na tabela mission_badges (UNIQUE).

export interface BadgeDef {
  key: string;
  name: string;
  emoji: string;
  description: string;
  unlocker: string;          // descrição curta da condição (UI)
}

export const BADGES: BadgeDef[] = [
  {
    key: 'primeiro_passo',
    name: 'Primeiro passo',
    emoji: '🚀',
    description: 'Você fez seu primeiro depósito. O começo é sempre o passo mais difícil.',
    unlocker: '1º depósito',
  },
  {
    key: 'consistente',
    name: 'Consistente',
    emoji: '🔥',
    description: 'Três meses seguidos guardando — é assim que se constrói o hábito.',
    unlocker: '3 meses seguidos',
  },
  {
    key: 'meio_caminho',
    name: 'Meio caminho',
    emoji: '🏆',
    description: 'Metade do alvo já é seu. Daqui pra frente é só descer a ladeira.',
    unlocker: '50% da meta',
  },
  {
    key: 'expert',
    name: 'Poupador Expert',
    emoji: '💎',
    description: 'Seis meses seguidos. Você virou um poupador de elite.',
    unlocker: '6 meses seguidos',
  },
  {
    key: 'meta_batida',
    name: 'Meta batida',
    emoji: '🎯',
    description: 'Missão cumprida! O dinheiro que você guardou agora é só seu.',
    unlocker: '100% da meta',
  },
  {
    key: 'mestre_clt',
    name: 'Mestre CLT',
    emoji: '👑',
    description: 'Duas missões concluídas. Você não para mais.',
    unlocker: '2 metas completas',
  },
];

export const BADGE_BY_KEY: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.key, b]),
);

// Nível exibido no header do dashboard. Regra do produto:
//   • 0–1 contribuições totais → Iniciante
//   • 2–3 meses com contribuição → Poupador ⭐
//   • 4–5 meses → Consistente 🔥
//   • 6+ meses → Expert 💎
// "Meses com contribuição" = contagem distinta do campo `month` (YYYY-MM).
// Múltiplos depósitos no mesmo mês contam como 1 mês ativo.
export function levelByActivity(
  contribsCount: number,
  monthsActive: number,
): { label: string; emoji: string } {
  if (monthsActive >= 6) return { label: 'Expert', emoji: '💎' };
  if (monthsActive >= 4) return { label: 'Consistente', emoji: '🔥' };
  if (monthsActive >= 2) return { label: 'Poupador', emoji: '⭐' };
  // contribsCount ∈ {0,1}: ainda Iniciante. Também cai aqui o caso raro de
  // várias contribuições concentradas num único mês (1 mês ativo).
  void contribsCount;
  return { label: 'Iniciante', emoji: '' };
}

// Chave interna para o marco de 25% (não aparece na grid pública de 6 badges,
// mas vai ao banco para detectar "cruzamento" e evitar refazer a animação).
export const QUARTER_BADGE_KEY = 'primeiro_quarto';
