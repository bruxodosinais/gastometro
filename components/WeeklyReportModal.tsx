'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { getCachedUser } from '@/lib/dataCache';
import { apiUrl } from '@/lib/native';

const STORAGE_KEY = 'weekly_report_dismissed_week';

type CategoryBreakdown = {
  category: string;
  amount: number;
  percentage: number;
  emoji: string;
};

type PendingBill = {
  description: string;
  amount: number;
  dueDay: number;
};

type Summary = {
  weekStart: string;
  weekEnd: string;
  totalSpent: number;
  variationPercent: number | null;
  topCategories: CategoryBreakdown[];
  pendingBills: PendingBill[];
};

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDateBR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// Semana ISO 8601 (segunda → domingo, semana 1 contém primeira quinta-feira do ano).
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

export default function WeeklyReportModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const now = new Date();
      // Só exibe às segundas-feiras (getDay() === 1).
      if (now.getDay() !== 1) return;

      const currentWeek = getISOWeekKey(now);
      try {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (dismissed === currentWeek) return;
      } catch {
        // localStorage indisponível — segue sem persistência (modal mostra na sessão).
      }

      // Confirma sessão antes de abrir.
      const user = await getCachedUser();
      if (!user) return;

      setLoading(true);
      setOpen(true);
      try {
        const res = await fetch(apiUrl('/api/reports/weekly-summary'), { cache: 'no-store' });
        if (!res.ok) {
          setOpen(false);
          return;
        }
        const data = (await res.json()) as Summary;
        setSummary(data);
      } catch {
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, getISOWeekKey(new Date()));
    } catch {
      // ignora falha de localStorage
    }
    setOpen(false);
  }

  function handleViewDetails() {
    handleDismiss();
    router.push('/historico');
  }

  if (!open) return null;

  const variation = summary?.variationPercent ?? null;
  const variationColor = variation === null ? '#6B6B6B' : variation >= 0 ? '#dc2626' : '#16a34a';
  const variationArrow = variation === null ? '' : variation >= 0 ? '↑' : '↓';

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3"
      onClick={handleDismiss}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 'var(--r)',
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Sua semana em números 📊
          </h3>
          <button
            onClick={handleDismiss}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bg)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
            aria-label="Fechar"
          >
            <X size={16} color="var(--text-2)" />
          </button>
        </div>

        {summary && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>
            Semana de {fmtDateBR(summary.weekStart)} a {fmtDateBR(summary.weekEnd)}
          </p>
        )}

        {loading || !summary ? (
          <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={22} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            <div
              style={{
                background: 'var(--bg)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                padding: 16,
                marginBottom: 16,
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Total gasto na semana
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: '4px 0 0' }}>
                {fmtBRL(summary.totalSpent)}
              </p>
              {variation !== null && (
                <p style={{ fontSize: 12, fontWeight: 700, color: variationColor, margin: '4px 0 0' }}>
                  {variationArrow} {Math.abs(variation).toFixed(0)}% vs semana anterior
                </p>
              )}
            </div>

            {summary.topCategories.length > 0 && (
              <>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                  Top categorias
                </p>
                <div style={{ marginBottom: 16 }}>
                  {summary.topCategories.map((c) => (
                    <div
                      key={c.category}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--border-2)',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {c.emoji} {c.category}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {fmtBRL(c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {summary.pendingBills.length > 0 && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 12px',
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 800, color: '#92400e', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ⚠️ {summary.pendingBills.length} conta{summary.pendingBills.length > 1 ? 's' : ''} pendente{summary.pendingBills.length > 1 ? 's' : ''}
                </p>
                <p style={{ fontSize: 12, color: '#92400e', margin: '4px 0 0' }}>
                  {summary.pendingBills.slice(0, 2).map((b) => b.description).join(', ')}
                  {summary.pendingBills.length > 2 ? '…' : ''}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleViewDetails}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--accent)',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Ver detalhes completos
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                }}
              >
                Lembrar semana que vem
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', margin: '4px 0 0' }}>
                O resumo volta na próxima segunda-feira.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
