'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { getCachedUser } from '@/lib/dataCache';
import { usePeriod } from '@/lib/periodContext';
import { getMonthKey } from '@/lib/calculations';
import {
  getMonthlyObligations,
  getRecurringExpenses,
  getExpenses,
  checkAndGenerateObligations,
} from '@/lib/storage';

export default function TopbarDesktop() {
  const router = useRouter();
  const { period, setPeriod } = usePeriod();
  const [userName, setUserName] = useState('');
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = await getCachedUser();
      if (!user || !mounted) return;
      const meta = user.user_metadata as Record<string, string> | undefined;
      const name =
        meta?.display_name ||
        meta?.full_name?.split(' ')[0] ||
        meta?.name?.split(' ')[0] ||
        user.email?.split('@')[0] ||
        '';
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await checkAndGenerateObligations();
        const monthKey = new Date().toISOString().slice(0, 7);
        const [obs, recs, exp] = await Promise.all([
          getMonthlyObligations(monthKey),
          getRecurringExpenses(),
          getExpenses(),
        ]);
        if (!mounted) return;
        const today = new Date().getDate();
        const isDayReached = (dom?: number) => dom == null || dom <= today;
        const pendingObs = obs.filter(o => o.status === 'pending').filter(o => {
          const rec = recs.find(r => r.id === o.recurringExpenseId);
          return rec ? isDayReached(rec.dayOfMonth) : true;
        }).length;
        const receivedIds = new Set(
          exp.filter(e => e.date.slice(0, 7) === monthKey && e.type === 'income' && e.recurringExpenseId)
             .map(e => e.recurringExpenseId as string)
        );
        const pendingIncome = recs
          .filter(r => r.active && r.type === 'income')
          .filter(r => !receivedIds.has(r.id) && isDayReached(r.dayOfMonth)).length;
        setHasPending(pendingObs + pendingIncome > 0);
      } catch {
        setHasPending(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const [periodYear, periodMonth] = period.split('-').map(Number);
  function goPrevMonth() {
    setPeriod(getMonthKey(new Date(periodYear, periodMonth - 2, 1)));
  }
  function goNextMonth() {
    setPeriod(getMonthKey(new Date(periodYear, periodMonth, 1)));
  }
  const periodDateObj = new Date(periodYear, periodMonth - 1, 1);
  const navigatorLabel = (() => {
    const raw = periodDateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  return (
    <header
      className="desktop-only"
      style={{
        position: 'fixed',
        top: 0,
        left: 232,
        right: 0,
        height: 58,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center',
        padding: '0 24px',
        zIndex: 30,
        gap: 18,
      }}
    >
      {/* Esquerda: saudação + nome + divisor + navegador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
            {greeting} 👋
          </span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 900,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.1,
            }}
          >
            {userName || 'Olá'}
          </span>
        </div>

        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={goPrevMonth}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={14} color="var(--text-2)" />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', minWidth: 110, textAlign: 'center' }}>
            {navigatorLabel}
          </span>
          <button
            onClick={goNextMonth}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Próximo mês"
          >
            <ChevronRight size={14} color="var(--text-2)" />
          </button>
        </div>
      </div>

      {/* Direita: notificações + Lançar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => router.push('/app')}
          style={{
            position: 'relative',
            width: 34,
            height: 34,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Notificações"
          title="Notificações"
        >
          <Bell size={15} color="var(--text-2)" />
          {hasPending && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 7,
                height: 7,
                background: 'var(--yellow)',
                borderRadius: '50%',
              }}
            />
          )}
        </button>

        <Link
          href="/lancamentos"
          style={{
            height: 34,
            padding: '0 14px',
            borderRadius: 9,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
            boxShadow: '0 4px 12px var(--accent-shadow)',
          }}
        >
          <Plus size={15} strokeWidth={2.6} />
          Lançar
        </Link>
      </div>
    </header>
  );
}
