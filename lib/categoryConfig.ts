import { Category, CustomCategory } from './types';

export type Config = {
  icon: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  barClass: string;
};

export const CATEGORY_CONFIG: Record<Category, Config> = {
  // Categorias de gasto
  Delivery: {
    icon: '🛵',
    color: '#f97316',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/20',
    textClass: 'text-orange-400',
    barClass: 'bg-orange-500',
  },
  Alimentação: {
    icon: '🛒',
    color: '#22c55e',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/20',
    textClass: 'text-green-400',
    barClass: 'bg-green-500',
  },
  Transporte: {
    icon: '🚗',
    color: '#3b82f6',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/20',
    textClass: 'text-blue-400',
    barClass: 'bg-blue-500',
  },
  Assinaturas: {
    icon: '🔄',
    color: '#8b5cf6',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/20',
    textClass: 'text-violet-400',
    barClass: 'bg-violet-500',
  },
  Saúde: {
    icon: '🏥',
    color: '#f43f5e',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/20',
    textClass: 'text-rose-400',
    barClass: 'bg-rose-500',
  },
  Lazer: {
    icon: '🎮',
    color: '#eab308',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/20',
    textClass: 'text-yellow-400',
    barClass: 'bg-yellow-500',
  },
  Moradia: {
    icon: '🏠',
    color: '#6366f1',
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/20',
    textClass: 'text-indigo-400',
    barClass: 'bg-indigo-500',
  },
  Educação: {
    icon: '📚',
    color: '#0891b2',
    bgClass: 'bg-cyan-600/10',
    borderClass: 'border-cyan-600/20',
    textClass: 'text-cyan-400',
    barClass: 'bg-cyan-600',
  },
  Investimentos: {
    icon: '📈',
    color: '#059669',
    bgClass: 'bg-emerald-600/10',
    borderClass: 'border-emerald-600/20',
    textClass: 'text-emerald-400',
    barClass: 'bg-emerald-600',
  },
  Pet: {
    icon: '🐾',
    color: '#d97706',
    bgClass: 'bg-amber-600/10',
    borderClass: 'border-amber-600/20',
    textClass: 'text-amber-400',
    barClass: 'bg-amber-600',
  },
  Presente: {
    icon: '🎁',
    color: '#ec4899',
    bgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/20',
    textClass: 'text-pink-500',
    barClass: 'bg-pink-500',
  },
  Vestuário: {
    icon: '👕',
    color: '#db2777',
    bgClass: 'bg-pink-600/10',
    borderClass: 'border-pink-600/20',
    textClass: 'text-pink-400',
    barClass: 'bg-pink-600',
  },
  Beleza: {
    icon: '💄',
    color: '#c026d3',
    bgClass: 'bg-fuchsia-600/10',
    borderClass: 'border-fuchsia-600/20',
    textClass: 'text-fuchsia-400',
    barClass: 'bg-fuchsia-600',
  },
  Farmácia: {
    icon: '💊',
    color: '#dc2626',
    bgClass: 'bg-red-600/10',
    borderClass: 'border-red-600/20',
    textClass: 'text-red-400',
    barClass: 'bg-red-600',
  },
  Combustível: {
    icon: '⛽',
    color: '#ea580c',
    bgClass: 'bg-orange-600/10',
    borderClass: 'border-orange-600/20',
    textClass: 'text-orange-500',
    barClass: 'bg-orange-600',
  },
  Internet: {
    icon: '📡',
    color: '#0284c7',
    bgClass: 'bg-sky-600/10',
    borderClass: 'border-sky-600/20',
    textClass: 'text-sky-400',
    barClass: 'bg-sky-600',
  },
  Telefone: {
    icon: '📱',
    color: '#7c3aed',
    bgClass: 'bg-purple-600/10',
    borderClass: 'border-purple-600/20',
    textClass: 'text-purple-400',
    barClass: 'bg-purple-600',
  },
  Outros: {
    icon: '📦',
    color: '#94a3b8',
    bgClass: 'bg-slate-500/10',
    borderClass: 'border-slate-500/20',
    textClass: 'text-slate-400',
    barClass: 'bg-slate-500',
  },
  Viagem: {
    icon: '✈️',
    color: '#0d9488',
    bgClass: 'bg-teal-600/10',
    borderClass: 'border-teal-600/20',
    textClass: 'text-teal-500',
    barClass: 'bg-teal-600',
  },
  'Cartão de Crédito': {
    icon: '💳',
    color: '#6366f1',
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/20',
    textClass: 'text-indigo-400',
    barClass: 'bg-indigo-500',
  },
  // Categorias de receita
  Salário: {
    icon: '💰',
    color: '#22c55e',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/20',
    textClass: 'text-green-400',
    barClass: 'bg-green-500',
  },
  Freela: {
    icon: '💻',
    color: '#06b6d4',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/20',
    textClass: 'text-cyan-400',
    barClass: 'bg-cyan-500',
  },
  'Renda passiva': {
    icon: '📊',
    color: '#10b981',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    barClass: 'bg-emerald-500',
  },
  // Categoria de sistema — receita gerada pelo onboarding como saldo de
  // partida. Não aparece em seletores (fora de INCOME_CATEGORIES), mas o
  // Record<Category> exige a entrada para os lançamentos existentes.
  'Saldo inicial': {
    icon: '🏦',
    color: '#5B5BD6',
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/20',
    textClass: 'text-indigo-400',
    barClass: 'bg-indigo-500',
  },
  // Despesas — expansão do catálogo
  Academia: {
    icon: '🏋️',
    color: '#F97316',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/20',
    textClass: 'text-orange-400',
    barClass: 'bg-orange-500',
  },
  Água: {
    icon: '💧',
    color: '#0EA5E9',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/20',
    textClass: 'text-sky-400',
    barClass: 'bg-sky-500',
  },
  Luz: {
    icon: '💡',
    color: '#EAB308',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/20',
    textClass: 'text-yellow-400',
    barClass: 'bg-yellow-500',
  },
  Gás: {
    icon: '🔥',
    color: '#F97316',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/20',
    textClass: 'text-orange-400',
    barClass: 'bg-orange-500',
  },
  Condomínio: {
    icon: '🏢',
    color: '#6B7280',
    bgClass: 'bg-gray-500/10',
    borderClass: 'border-gray-500/20',
    textClass: 'text-gray-400',
    barClass: 'bg-gray-500',
  },
  Streaming: {
    icon: '📺',
    color: '#8B5CF6',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/20',
    textClass: 'text-violet-400',
    barClass: 'bg-violet-500',
  },
  Games: {
    icon: '🎮',
    color: '#6366F1',
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/20',
    textClass: 'text-indigo-400',
    barClass: 'bg-indigo-500',
  },
  'Cuidados pessoais': {
    icon: '🪥',
    color: '#EC4899',
    bgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/20',
    textClass: 'text-pink-400',
    barClass: 'bg-pink-500',
  },
  Médico: {
    icon: '🩺',
    color: '#10B981',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    barClass: 'bg-emerald-500',
  },
  Dentista: {
    icon: '🦷',
    color: '#14B8A6',
    bgClass: 'bg-teal-500/10',
    borderClass: 'border-teal-500/20',
    textClass: 'text-teal-400',
    barClass: 'bg-teal-500',
  },
  Psicólogo: {
    icon: '🧠',
    color: '#A855F7',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
    textClass: 'text-purple-400',
    barClass: 'bg-purple-500',
  },
  Crianças: {
    icon: '🧒',
    color: '#F59E0B',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    textClass: 'text-amber-400',
    barClass: 'bg-amber-500',
  },
  Trabalho: {
    icon: '💼',
    color: '#374151',
    bgClass: 'bg-gray-700/10',
    borderClass: 'border-gray-700/20',
    textClass: 'text-gray-300',
    barClass: 'bg-gray-700',
  },
  Doação: {
    icon: '🤝',
    color: '#00C37A',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    barClass: 'bg-emerald-500',
  },
  Imposto: {
    icon: '🏛️',
    color: '#6B7280',
    bgClass: 'bg-gray-500/10',
    borderClass: 'border-gray-500/20',
    textClass: 'text-gray-400',
    barClass: 'bg-gray-500',
  },
  Seguro: {
    icon: '🛡️',
    color: '#3B82F6',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/20',
    textClass: 'text-blue-400',
    barClass: 'bg-blue-500',
  },
  Manutenção: {
    icon: '🔧',
    color: '#78716C',
    bgClass: 'bg-stone-500/10',
    borderClass: 'border-stone-500/20',
    textClass: 'text-stone-400',
    barClass: 'bg-stone-500',
  },
  'Compras online': {
    icon: '📦',
    color: '#F97316',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/20',
    textClass: 'text-orange-400',
    barClass: 'bg-orange-500',
  },
  // Receitas — expansão do catálogo
  Bônus: {
    icon: '🎯',
    color: '#00C37A',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    barClass: 'bg-emerald-500',
  },
  '13º salário': {
    icon: '📅',
    color: '#00C37A',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    barClass: 'bg-emerald-500',
  },
  'Aluguel recebido': {
    icon: '🏠',
    color: '#10B981',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    barClass: 'bg-emerald-500',
  },
  Dividendos: {
    icon: '📈',
    color: '#059669',
    bgClass: 'bg-emerald-600/10',
    borderClass: 'border-emerald-600/20',
    textClass: 'text-emerald-400',
    barClass: 'bg-emerald-600',
  },
  Venda: {
    icon: '🏷️',
    color: '#16A34A',
    bgClass: 'bg-green-600/10',
    borderClass: 'border-green-600/20',
    textClass: 'text-green-400',
    barClass: 'bg-green-600',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Categorias custom: paleta de cores e catálogo de emojis para o picker.
//
// As 12 cores abaixo são EXATAMENTE as tonalidades já usadas em CATEGORY_CONFIG
// para garantir consistência visual entre categorias fixas e custom. Cada cor
// é associada às mesmas classes Tailwind das fixas, então custom categories
// renderizam idênticas a uma fixa do mesmo tom.
// ─────────────────────────────────────────────────────────────────────────────

export interface PaletteOption {
  color: string; // hex (gravado no banco)
  bgClass: string;
  borderClass: string;
  textClass: string;
  barClass: string;
}

export const CUSTOM_COLOR_PALETTE: PaletteOption[] = [
  { color: '#F97316', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20', textClass: 'text-orange-400', barClass: 'bg-orange-500' },
  { color: '#0EA5E9', bgClass: 'bg-sky-500/10',    borderClass: 'border-sky-500/20',    textClass: 'text-sky-400',    barClass: 'bg-sky-500' },
  { color: '#EAB308', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/20', textClass: 'text-yellow-400', barClass: 'bg-yellow-500' },
  { color: '#8B5CF6', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500/20', textClass: 'text-violet-400', barClass: 'bg-violet-500' },
  { color: '#6366F1', bgClass: 'bg-indigo-500/10', borderClass: 'border-indigo-500/20', textClass: 'text-indigo-400', barClass: 'bg-indigo-500' },
  { color: '#EC4899', bgClass: 'bg-pink-500/10',   borderClass: 'border-pink-500/20',   textClass: 'text-pink-400',   barClass: 'bg-pink-500' },
  { color: '#10B981', bgClass: 'bg-emerald-500/10',borderClass: 'border-emerald-500/20',textClass: 'text-emerald-400',barClass: 'bg-emerald-500' },
  { color: '#14B8A6', bgClass: 'bg-teal-500/10',   borderClass: 'border-teal-500/20',   textClass: 'text-teal-400',   barClass: 'bg-teal-500' },
  { color: '#A855F7', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/20', textClass: 'text-purple-400', barClass: 'bg-purple-500' },
  { color: '#F59E0B', bgClass: 'bg-amber-500/10',  borderClass: 'border-amber-500/20',  textClass: 'text-amber-400',  barClass: 'bg-amber-500' },
  { color: '#3B82F6', bgClass: 'bg-blue-500/10',   borderClass: 'border-blue-500/20',   textClass: 'text-blue-400',   barClass: 'bg-blue-500' },
  { color: '#78716C', bgClass: 'bg-stone-500/10',  borderClass: 'border-stone-500/20',  textClass: 'text-stone-400',  barClass: 'bg-stone-500' },
];

// ~30 emojis cobrindo despesas/receitas comuns. O usuário escolhe um no picker.
export const EMOJI_CATALOG: string[] = [
  '💰', '💸', '💳', '🛒', '🍔', '🍕', '☕', '🍺',
  '🚗', '🛵', '✈️', '🚌', '⛽', '🏠', '🏢', '🛏️',
  '💡', '💧', '🔥', '📱', '📡', '🎮', '🎬', '📚',
  '🎓', '👕', '👟', '💄', '🐾', '🎁', '🏥', '💊',
  '🩺', '🦷', '🧠', '🏋️', '🧘', '🛠️', '🔧', '📦',
  '🎯', '📈', '📊', '🤝', '🏛️', '🛡️', '🪥', '🧒',
];

// ─────────────────────────────────────────────────────────────────────────────
// Fallback genérico para strings desconhecidas. Usado quando uma categoria
// armazenada não existe nem em CATEGORY_CONFIG nem na lista de custom (ex.:
// o usuário deletou a custom mas ainda há lançamentos órfãos com esse nome).
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_CONFIG: Config = {
  icon: '📦',
  color: '#94a3b8',
  bgClass: 'bg-slate-500/10',
  borderClass: 'border-slate-500/20',
  textClass: 'text-slate-400',
  barClass: 'bg-slate-500',
};

function paletteForColor(color: string): PaletteOption | undefined {
  return CUSTOM_COLOR_PALETTE.find((p) => p.color.toLowerCase() === color.toLowerCase());
}

// Resolve uma categoria (fixa ou custom) para o Config que descreve sua
// renderização. Fonte de busca, em ordem:
//   1. CATEGORY_CONFIG (categorias fixas do sistema)
//   2. customCategories (passadas pelo caller via useCustomCategories)
//   3. FALLBACK_CONFIG (📦 cinza)
//
// Por que receber customCategories como parâmetro em vez de ler de um cache
// global aqui dentro: este módulo é importado por server components/routes que
// não têm acesso a hooks. Cada caller que renderiza categorias custom é
// responsável por buscar a lista (useCustomCategories) e passar adiante.
// Sites server-side (admin/stats route) chamam sem o segundo argumento e
// recebem fallback para custom — aceitável porque admin não personaliza por
// usuário.
export function getCategoryDisplay(
  name: string,
  customCategories?: CustomCategory[],
): Config {
  const fixed = CATEGORY_CONFIG[name as Category];
  if (fixed) return fixed;

  const custom = customCategories?.find((c) => c.name === name);
  if (custom) {
    const palette = paletteForColor(custom.color);
    return {
      icon: custom.icon,
      color: custom.color,
      bgClass: palette?.bgClass ?? FALLBACK_CONFIG.bgClass,
      borderClass: palette?.borderClass ?? FALLBACK_CONFIG.borderClass,
      textClass: palette?.textClass ?? FALLBACK_CONFIG.textClass,
      barClass: palette?.barClass ?? FALLBACK_CONFIG.barClass,
    };
  }

  return FALLBACK_CONFIG;
}

