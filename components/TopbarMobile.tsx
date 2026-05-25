'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/themeContext';
import {
  checkAndGenerateObligations,
  getExpenses,
  getMonthlyObligations,
  getRecurringExpenses,
} from '@/lib/storage';

// Mantemos o drawer de notificações vivendo na home, mas o sino agora mora
// na topbar global. Quando o usuário já está em /app, evitamos o noop do
// router.push e abrimos o drawer direto via custom event.
export const OPEN_NOTIF_EVENT = 'gastometro_open_notifications';

/**
 * Topbar global mobile-only. Mesma estrutura visual do TopbarDesktop:
 * logo à esquerda + (toggle de tema + sino) à direita. Fixed no topo;
 * o layout (app) adiciona pt mobile correspondente para o conteúdo não
 * ficar atrás.
 *
 * O sino navega para /app (onde o drawer de notificações está montado),
 * espelhando o comportamento do TopbarDesktop. O indicador amarelo segue
 * a mesma regra de "pendências do mês".
 */
export default function TopbarMobile() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [hasPending, setHasPending] = useState(false);

  function handleBellClick() {
    if (pathname === '/app') {
      window.dispatchEvent(new CustomEvent(OPEN_NOTIF_EVENT));
    } else {
      router.push('/app');
    }
  }

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
        const pendingObs = obs
          .filter((o) => o.status === 'pending')
          .filter((o) => {
            const rec = recs.find((r) => r.id === o.recurringExpenseId);
            return rec ? isDayReached(rec.dayOfMonth) : true;
          }).length;
        const receivedIds = new Set(
          exp
            .filter(
              (e) =>
                e.date.slice(0, 7) === monthKey &&
                e.type === 'income' &&
                e.recurringExpenseId,
            )
            .map((e) => e.recurringExpenseId as string),
        );
        const pendingIncome = recs
          .filter((r) => r.active && r.type === 'income')
          .filter((r) => !receivedIds.has(r.id) && isDayReached(r.dayOfMonth))
          .length;
        setHasPending(pendingObs + pendingIncome > 0);
      } catch {
        setHasPending(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header
      className="mobile-only"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 40,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-horizontal.png"
        alt="TôOrganizado"
        style={{ height: 22, width: 'auto', display: 'block' }}
      />

      {/* Ações: toggle tema + sino */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={
            resolvedTheme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'
          }
          title={resolvedTheme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          style={{
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
        >
          {resolvedTheme === 'dark' ? (
            <Sun size={15} color="var(--text-2)" />
          ) : (
            <Moon size={15} color="var(--text-2)" />
          )}
        </button>

        <button
          onClick={handleBellClick}
          aria-label="Notificações"
          title="Notificações"
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
      </div>
    </header>
  );
}
