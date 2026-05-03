import { Category } from './types';

type Config = {
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
};
