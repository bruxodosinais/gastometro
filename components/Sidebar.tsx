'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Plus, RefreshCw, Clock, LayoutGrid,
  Target, CreditCard, TrendingUp, LineChart, Bot, UserCircle,
  MessageSquare, Rocket, Headphones, BarChart2, PieChart, LogOut,
  Sun, Moon, Zap, ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/dataCache';
import { openFeedback } from '@/components/FeedbackButton';
import { openSupport } from '@/components/SupportButton';
import { useMonthlyPending } from '@/lib/hooks/useMonthlyPending';
import { useSubscription } from '@/hooks/useSubscription';
import { MISSAO_FEATURE_KEY, markFeatureSeen, shouldShowNewBadge } from '@/lib/featureFlags';
import { useTheme } from '@/lib/themeContext';

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
      { href: '/orcamentos',  label: 'Orçamentos',           Icon: PieChart    },
      { href: '/analise',     label: 'Análise',              Icon: BarChart2   },
      { href: '/previsoes',   label: 'Previsões',            Icon: LineChart   },
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

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 8px', borderRadius: 8,
  background: 'transparent', color: 'var(--text-2)',
  fontSize: 13, fontWeight: 700,
  border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', textAlign: 'left' as const,
  textDecoration: 'none', width: '100%',
  transition: 'background 120ms',
};

const iconWrap: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  display: 'flex', alignItems: 'center',
  justifyContent: 'center', flexShrink: 0,
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push('/auth/login');
  }
  const recurringPending = useMonthlyPending();
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const { isPro, loading: subLoading } = useSubscription();

  // Fecha painel ao navegar
  useEffect(() => { setProfileOpen(false); }, [pathname]);

  // Fecha ao clicar fora e no ESC
  useEffect(() => {
    if (!profileOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

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

      {/* User card + painel dropdown */}
      <div ref={profileRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setProfileOpen((prev) => !prev)}
          style={{
            margin: '4px 12px 8px',
            padding: '10px 12px',
            borderRadius: 12,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: 'calc(100% - 24px)',
            textAlign: 'left',
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
          <ChevronDown
            size={14}
            color="var(--text-3)"
            style={{
              flexShrink: 0,
              transform: `rotate(${profileOpen ? 180 : 0}deg)`,
              transition: 'transform 200ms',
            }}
          />
        </button>

        {/* Painel dropdown */}
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 12,
            right: 12,
            zIndex: 50,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            opacity: profileOpen ? 1 : 0,
            transform: profileOpen ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'opacity 180ms, transform 180ms',
            pointerEvents: profileOpen ? 'auto' : 'none',
          }}
        >
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              {userName || 'Você'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
              {isPro ? 'Plano Pro ✓' : 'Plano Gratuito'}
            </p>
          </div>

          <div style={{ padding: '6px 8px' }}>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              style={itemStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={iconWrap}>
                {resolvedTheme === 'dark'
                  ? <Sun size={15} color="var(--text-2)" />
                  : <Moon size={15} color="var(--text-2)" />}
              </span>
              <span style={{ flex: 1 }}>
                {resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              </span>
            </button>

            <Link
              href="/perfil"
              onClick={() => setProfileOpen(false)}
              style={itemStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={iconWrap}><UserCircle size={15} color="var(--text-2)" /></span>
              <span style={{ flex: 1 }}>Perfil completo</span>
            </Link>

            {!isPro && (
              <Link
                href="/upgrade"
                onClick={() => setProfileOpen(false)}
                style={{ ...itemStyle, color: 'var(--accent)', fontWeight: 800 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={iconWrap}><Zap size={15} color="var(--accent)" /></span>
                <span style={{ flex: 1 }}>Fazer upgrade</span>
              </Link>
            )}

            <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />

            <button
              type="button"
              onClick={() => { setProfileOpen(false); handleLogout(); }}
              style={{ ...itemStyle, color: 'var(--red)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={iconWrap}><LogOut size={15} color="var(--red)" /></span>
              <span style={{ flex: 1 }}>Sair</span>
            </button>
          </div>
        </div>
      </div>
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
        <button
          type="button"
          onClick={handleLogout}
          style={{
            marginTop: 4,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 10px 8px',
            background: 'transparent',
            color: 'var(--text-2)',
            fontSize: 13,
            fontWeight: 700,
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
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
            <LogOut size={16} color="var(--text-2)" />
          </span>
          <span style={{ flex: 1 }}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
