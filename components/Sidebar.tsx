'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Plus, RefreshCw, Clock, LayoutGrid,
  Target, CreditCard, TrendingUp, Bot, UserCircle,
  MessageSquare, Rocket, Headphones, BarChart2,
} from 'lucide-react';
import { getCachedUser } from '@/lib/dataCache';
import { openFeedback } from '@/components/FeedbackButton';
import { openSupport } from '@/components/SupportButton';
import {
  getMonthlyObligations,
  getRecurringExpenses,
  getExpenses,
  checkAndGenerateObligations,
} from '@/lib/storage';
import { useSubscription } from '@/hooks/useSubscription';
import { MISSAO_FEATURE_KEY, markFeatureSeen, shouldShowNewBadge } from '@/lib/featureFlags';

type Section = {
  title: string;
  items: Array<{
    href: string;
    label: string;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
    badgeKey?: 'recorrentes';
    newKey?: string;
  }>;
};

const SECTIONS: Section[] = [
  {
    title: 'Principal',
    items: [
      { href: '/app',         label: 'Home',        Icon: Home       },
      { href: '/lancamentos', label: 'Lançar',      Icon: Plus       },
      { href: '/recorrentes', label: 'Recorrentes', Icon: RefreshCw, badgeKey: 'recorrentes' },
      { href: '/historico',   label: 'Histórico',   Icon: Clock      },
    ],
  },
  {
    title: 'Finanças',
    items: [
      { href: '/missao',      label: 'Missão de Poupança 🎯', Icon: Rocket,    newKey: MISSAO_FEATURE_KEY },
      { href: '/categorias',  label: 'Categorias',           Icon: LayoutGrid  },
      { href: '/analise',     label: 'Análise',              Icon: BarChart2   },
      { href: '/metas',       label: 'Metas',                Icon: Target      },
      { href: '/cartoes',     label: 'Cartões',              Icon: CreditCard  },
      { href: '/patrimonio',  label: 'Patrimônio',           Icon: TrendingUp  },
    ],
  },
  {
    title: 'Outros',
    items: [
      { href: '/assistente',  label: 'Assistente',  Icon: Bot         },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState('');
  const [recurringPending, setRecurringPending] = useState(0);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const { isPro, loading: subLoading } = useSubscription();

  // Avalia o selo NOVO no cliente (localStorage indisponível no SSR).
  useEffect(() => {
    const eligible = new Set<string>();
    for (const section of SECTIONS) {
      for (const it of section.items) {
        if (it.newKey && shouldShowNewBadge(it.newKey)) eligible.add(it.newKey);
      }
    }
    setNewKeys(eligible);
  }, [pathname]);

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
        setRecurringPending(pendingObs + pendingIncome);
      } catch {
        // sem dados ainda — não exibe badge
      }
    })();
    return () => { mounted = false; };
  }, [pathname]);

  const initial = userName ? userName.charAt(0).toUpperCase() : '?';

  function NavItem({
    href, label, Icon, active, badge, isNew, onNavigate,
  }: {
    href: string; label: string;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
    active: boolean; badge?: number; isNew?: boolean;
    onNavigate?: () => void;
  }) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          borderRadius: 10,
          background: active ? 'var(--accent-bg)' : 'transparent',
          color: active ? 'var(--accent)' : 'var(--text-2)',
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
          transition: 'background 120ms, color 120ms',
        }}
        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: active ? 'rgba(91,91,214,0.12)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={active ? 'var(--accent)' : 'var(--text-2)'} />
        </span>
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        {isNew && (
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 999,
              background: 'var(--green)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            Novo
          </span>
        )}
        {badge != null && badge > 0 && (
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: '0 6px',
              borderRadius: 9,
              background: 'var(--red)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      className="desktop-only"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 232,
        height: '100vh',
        background: 'var(--surface)',
        borderRight: '1.5px solid var(--border)',
        flexDirection: 'column',
        zIndex: 40,
      }}
    >
      {/* Brand */}
      <div style={{ padding: '18px 16px 12px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-horizontal.png"
          alt="TôOrganizado"
          style={{ height: 26, width: 'auto', maxWidth: '100%', display: 'block' }}
        />
      </div>

      {/* User card */}
      <Link
        href="/perfil"
        style={{
          margin: '4px 12px 8px',
          padding: '10px 12px',
          borderRadius: 12,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 6px var(--avatar-shadow)',
          }}
        >
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--text)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {userName || 'Você'}
          </p>
          {!subLoading && (
            isPro ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  marginTop: 2,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                }}
              >
                PRO ✓
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 2,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                Plano gratuito
              </span>
            )
          )}
        </div>
      </Link>
      {!subLoading && !isPro && (
        <Link
          href="/upgrade"
          style={{
            margin: '0 12px 8px',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'var(--accent-bg)',
            border: '1px solid rgba(91,91,214,0.25)',
            color: 'var(--accent)',
            fontSize: 11,
            fontWeight: 800,
            textDecoration: 'none',
            textAlign: 'center',
          }}
        >
          ✨ Fazer upgrade
        </Link>
      )}

      {/* Nav scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px' }}>
        {SECTIONS.map((section) => (
          <div key={section.title} style={{ marginTop: 10 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--text-3)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: '6px 10px 6px',
              }}
            >
              {section.title}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map((item) => {
                const active = pathname === item.href;
                const badge = item.badgeKey === 'recorrentes' ? recurringPending : undefined;
                const isNew = !!item.newKey && newKeys.has(item.newKey);
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    Icon={item.Icon}
                    active={active}
                    badge={badge}
                    isNew={isNew}
                    onNavigate={item.newKey ? () => markFeatureSeen(item.newKey!) : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer fixo */}
      <div
        style={{
          borderTop: '1px solid var(--border-2)',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <button
          type="button"
          onClick={() => openFeedback()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'transparent',
            color: 'var(--text-2)',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
            transition: 'background 120ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MessageSquare size={16} color="var(--text-2)" />
          </span>
          <span style={{ flex: 1 }}>Enviar feedback</span>
        </button>
        <button
          type="button"
          onClick={() => openSupport()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'transparent',
            color: 'var(--text-2)',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
            transition: 'background 120ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Headphones size={16} color="var(--text-2)" />
          </span>
          <span style={{ flex: 1 }}>Suporte</span>
        </button>
        <NavItem
          href="/perfil"
          label="Perfil"
          Icon={UserCircle}
          active={pathname === '/perfil'}
        />
      </div>
    </aside>
  );
}
