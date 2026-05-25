// Wrapper UI-facing dos badges. A fonte de verdade visual (emoji/nome/desc/
// category) está em `lib/badges.ts`; aqui adicionamos só o `unlocker` — texto
// curto para mostrar na grid (ex.: "1º depósito", "3 meses seguidos") — e
// reexportamos a lista ordenada para os consumidores existentes (dashboard,
// página de badges).

import {
  BADGE_DEFINITIONS,
  BADGE_ORDER,
  type BadgeCategory,
  type BadgeDefinition,
} from '@/lib/badges';

export interface BadgeDef extends BadgeDefinition {
  unlocker: string; // descrição curta da condição (UI)
}

const UNLOCKERS: Record<string, string> = {
  primeiro_passo: '1º depósito',
  largada_rapida: '1º depósito em 7 dias',
  consistente: '3 meses seguidos',
  em_chama: '3 meses consecutivos',
  meio_caminho: '50% da meta',
  dobrou_meta: 'Dobrar a meta do mês',
  pontual: 'Sem pular meses',
  expert: '6 meses seguidos',
  inabalavel: '6 meses consecutivos',
  poupador_iniciante: 'R$ 1.000 acumulados',
  poupador_dedicado: 'R$ 5.000 acumulados',
  meta_batida: '100% da meta',
  mestre_clt: '2 metas completas',
  recorrente: '3 missões concluídas',
  serial_saver: '5 missões concluídas',
  lendario: '12 meses consecutivos',
  poupador_elite: 'R$ 50.000 acumulados',
};

export const BADGES: BadgeDef[] = BADGE_ORDER.map((key) => {
  const def = BADGE_DEFINITIONS[key];
  return { ...def, unlocker: UNLOCKERS[key] ?? '' };
});

export const BADGE_BY_KEY: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.key, b]),
);

export function badgesByCategory(): Record<BadgeCategory, BadgeDef[]> {
  const out: Record<BadgeCategory, BadgeDef[]> = {
    streak: [],
    valor: [],
    missoes: [],
    comportamento: [],
  };
  for (const b of BADGES) out[b.category].push(b);
  return out;
}

// Chave interna para o marco de 25% (não aparece na grid pública, mas vai ao
// banco para detectar "cruzamento" e evitar refazer a animação).
export const QUARTER_BADGE_KEY = 'primeiro_quarto';
