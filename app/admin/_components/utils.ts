import type { FeedbackCategory } from './types';

export function fmt(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function fmtRelative(d: string | null | undefined): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `há ${days} dia${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  return `há ${months} m${months === 1 ? 'ês' : 'eses'}`;
}

export function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function initial(value: string | null | undefined): string {
  if (!value) return '?';
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const FEEDBACK_META: Record<FeedbackCategory, { emoji: string; label: string; color: string; bg: string }> = {
  bug: { emoji: '🐛', label: 'Bug', color: '#c0392b', bg: '#FEE2E2' },
  sugestao: { emoji: '💡', label: 'Sugestão', color: '#92400e', bg: '#FEF3C7' },
  elogio: { emoji: '❤️', label: 'Elogio', color: '#9d174d', bg: '#FCE7F3' },
  outro: { emoji: '💬', label: 'Outro', color: '#3730a3', bg: '#E0E7FF' },
};

export const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
  fontWeight: 700, color: 'var(--accent)', padding: '4px 6px', fontFamily: 'inherit',
};

export const pageBtn: React.CSSProperties = {
  padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
};
