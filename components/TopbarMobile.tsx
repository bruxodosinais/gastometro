'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Bell, Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from '@/lib/themeContext';
import { useMonthlyPending } from '@/lib/hooks/useMonthlyPending';
import { OPEN_DRAWER_EVENT } from '@/components/Navigation';

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
  const hasPending = useMonthlyPending() > 0;

  function handleBellClick() {
    if (pathname === '/app') {
      window.dispatchEvent(new CustomEvent(OPEN_NOTIF_EVENT));
    } else {
      router.push('/app');
    }
  }

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
      {/* Botão de menu (abre drawer lateral) */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_DRAWER_EVENT))}
        aria-label="Menu"
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
          flexShrink: 0,
        }}
      >
        <Menu size={20} color="var(--text-2)" />
      </button>

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
