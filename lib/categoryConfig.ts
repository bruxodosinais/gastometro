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
    icon: '📱',
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
  Outros: {
    icon: '📦',
    color: '#94a3b8',
    bgClass: 'bg-slate-500/10',
    borderClass: 'border-slate-500/20',
    textClass: 'text-slate-400',
    barClass: 'bg-slate-500',
  },
};
