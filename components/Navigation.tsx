'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Plus, Clock, RefreshCw, UserCircle, X, CreditCard, Sparkles,
  MessageSquare, Rocket, Headphones, BarChart2, PieChart, Target, Bot,
  TrendingUp, LineChart, LayoutGrid, ChevronRight, LogOut, Sun, Moon,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { openFeedback } from '@/components/FeedbackButton';
import { openSupport } from '@/components/SupportButton';
import { MISSAO_FEATURE_KEY, markFeatureSeen, shouldShowNewBadge } from '@/lib/featureFlags';
import { getCachedUser } from '@/lib/dataCache';
import { useTheme } from '@/lib/themeContext';
import { createClient } from '@/lib/supabase/client';

const ACTIVE = 'var(--accent)';
const INACTIVE = 'var(--text-3)';

export const OPEN_DRAWER_EVENT = 'toorganizado_open_drawer';

type SheetItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  newKey?: string;
};

const sheetItems: SheetItem[] = [
  { href: '/missao',      label: 'Missão de Poupança 🎯', Icon: Rocket,     newKey: MISSAO_FEATURE_KEY },
  { href: '/categorias',  label: 'Categorias',           Icon: LayoutGrid  },
  { href: '/orcamentos',  label: 'Orçamentos',           Icon: PieChart    },
  { href: '/analise',     label: 'Análise',              Icon: BarChart2   },
  { href: '/previsoes',   label: 'Previsões',            Icon: LineChart   },
  { href: '/metas',       label: 'Metas',                Icon: Target      },
  { href: '/cartoes',     label: 'Cartões',              Icon: CreditCard  },
  { href: '/patrimonio',  label: 'Patrimônio',           Icon: TrendingUp  },
  { href: '/assistente',  label: 'Assistente',           Icon: Bot         },
];

const listItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: '1px solid var(--border)',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text)',
  textDecoration: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left' as const,
  width: '100%',
};

const listIconWrap: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9,
  background: 'var(--bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export default function Navigation() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const { isFree, loading: subLoading } = useSubscription();
  const { resolvedTheme, setTheme } = useTheme();

  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const eligible = new Set<string>();
    for (const it of sheetItems) {
      if (it.newKey && shouldShowNewBadge(it.newKey)) eligible.add(it.newKey);
    }
    setNewKeys(eligible);
  }, [sheetOpen]);

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
      if (mounted) setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    })();
    return () => { mounted = false; };
  }, []);

  // Fecha ambos ao navegar
  useEffect(() => {
    setSheetOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  // Trava o scroll do body enquanto o sheet/drawer está aberto — sem isso a
  // página rola por trás do overlay. Mesma convenção dos outros sheets do app:
  // salva o overflow anterior e restaura no cleanup (não assume string vazia).
  useEffect(() => {
    if (!sheetOpen && !drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sheetOpen, drawerOpen]);

  // ESC fecha ambos
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSheetOpen(false);
        setDrawerOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Abre o drawer via evento do TopbarMobile
  useEffect(() => {
    function onOpen() { setDrawerOpen(true); }
    window.addEventListener(OPEN_DRAWER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DRAWER_EVENT, onOpen);
  }, []);

  async function handleLogout() {
    await createClient().auth.signOut();
    // Navegação DURA (não router.push): o reload zera o cache in-memory
    // (getCachedUser & cia). Sem isso, ao trocar de conta o app seguiria com o
    // user.id da conta anterior por até 5 min → insert com user_id ≠ auth.uid()
    // estoura a RLS (e arrisca misturar dados entre contas). Alinha com os outros
    // dois pontos de logout (app/page.tsx e perfil), que já fazem hard nav.
    window.location.href = '/auth/login';
  }

  const initial = userName ? userName.charAt(0).toUpperCase() : '?';
  const isPro = !isFree;
  const perfilActive = pathname === '/perfil' || sheetOpen;

  return (
    <>
      {/* ── MOBILE: tab bar fixa ─────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center h-16 px-2">

          {/* Home */}
          {(() => {
            const active = pathname === '/app';
            return (
              <Link href="/app" className="flex flex-col items-center gap-0.5 flex-1 py-2">
                <Home size={24} strokeWidth={active ? 2.5 : 1.8} color={active ? ACTIVE : INACTIVE} />
                <span className="text-xs font-medium" style={{ color: active ? ACTIVE : INACTIVE }}>Home</span>
              </Link>
            );
          })()}

          {/* Recorrentes */}
          {(() => {
            const active = pathname === '/recorrentes';
            return (
              <Link href="/recorrentes" className="flex flex-col items-center gap-0.5 flex-1 py-2">
                <RefreshCw size={24} strokeWidth={active ? 2.5 : 1.8} color={active ? ACTIVE : INACTIVE} />
                <span className="text-xs font-medium" style={{ color: active ? ACTIVE : INACTIVE }}>Recorrentes</span>
              </Link>
            );
          })()}

          {/* Lançar — botão central elevado */}
          <Link
            href="/lancamentos"
            className="flex flex-col items-center flex-1"
            style={{ transform: 'translateY(-12px)' }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px var(--plus-shadow)',
                flexShrink: 0,
              }}
            >
              <Plus size={28} color="white" strokeWidth={2.5} />
            </div>
            <span
              className="text-xs font-medium mt-1"
              style={{ color: pathname === '/lancamentos' ? ACTIVE : INACTIVE }}
            >
              Lançar
            </span>
          </Link>

          {/* Histórico */}
          {(() => {
            const active = pathname === '/historico';
            return (
              <Link href="/historico" className="flex flex-col items-center gap-0.5 flex-1 py-2">
                <Clock size={24} strokeWidth={active ? 2.5 : 1.8} color={active ? ACTIVE : INACTIVE} />
                <span className="text-xs font-medium" style={{ color: active ? ACTIVE : INACTIVE }}>Histórico</span>
              </Link>
            );
          })()}

          {/* Perfil */}
          <button
            onClick={() => setSheetOpen(true)}
            className="flex flex-col items-center gap-0.5 flex-1 py-2"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <UserCircle size={24} strokeWidth={perfilActive ? 2.5 : 1.8} color={perfilActive ? ACTIVE : INACTIVE} />
            <span className="text-xs font-medium" style={{ color: perfilActive ? ACTIVE : INACTIVE }}>Perfil</span>
          </button>

        </div>
      </nav>

      {/* ── SHEET "PERFIL" (sobe de baixo) ───────────────────────────────── */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '85vh',
              borderRadius: '20px 20px 0 0',
              background: 'var(--surface)',
              overflowY: 'auto',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    fontWeight: 800, fontSize: 17,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: '0 2px 8px var(--avatar-shadow)',
                  }}
                >
                  {initial}
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                    {userName || 'Você'}
                  </p>
                  {/* Status do plano (backend é a fonte de verdade — vale web e nativo). */}
                  {!subLoading && (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>
                      {isPro ? 'Plano Pro ✓' : 'Plano Gratuito'}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <X size={16} color="var(--text-2)" />
              </button>
            </div>

            {/* SEÇÃO: Conta */}
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 16px 4px', margin: 0, borderTop: '1px solid var(--border)' }}>
              Conta
            </p>

            <Link href="/perfil" onClick={() => setSheetOpen(false)} style={listItem}>
              <span style={listIconWrap}><UserCircle size={16} color="var(--text-2)" /></span>
              <span style={{ flex: 1 }}>Editar perfil</span>
              <ChevronRight size={16} color="var(--text-3)" />
            </Link>

            {!subLoading && isFree && (
              <Link href="/upgrade" onClick={() => setSheetOpen(false)} style={{ ...listItem, color: 'var(--accent)' }}>
                <span style={listIconWrap}><Sparkles size={16} color="var(--accent)" /></span>
                <span style={{ flex: 1 }}>Fazer upgrade</span>
                <ChevronRight size={16} color="var(--accent)" />
              </Link>
            )}

            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              style={listItem}
            >
              <span style={listIconWrap}>
                {resolvedTheme === 'dark'
                  ? <Sun size={16} color="var(--text-2)" />
                  : <Moon size={16} color="var(--text-2)" />}
              </span>
              <span style={{ flex: 1 }}>{resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
            </button>

            <button
              type="button"
              onClick={() => { setSheetOpen(false); openFeedback(); }}
              style={listItem}
            >
              <span style={listIconWrap}><MessageSquare size={16} color="var(--text-2)" /></span>
              <span style={{ flex: 1 }}>Enviar feedback</span>
            </button>

            <button
              type="button"
              onClick={() => { setSheetOpen(false); openSupport(); }}
              style={listItem}
            >
              <span style={listIconWrap}><Headphones size={16} color="var(--text-2)" /></span>
              <span style={{ flex: 1 }}>Suporte</span>
            </button>

            {/* SEÇÃO: Navegação */}
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 16px 4px', margin: 0, borderTop: '1px solid var(--border)' }}>
              Navegação
            </p>

            {!subLoading && isFree && (
              <Link
                href="/upgrade"
                onClick={() => setSheetOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  margin: '8px 16px',
                  background: 'var(--accent)', borderRadius: 14,
                  padding: '14px 16px', textDecoration: 'none',
                  boxShadow: '0 6px 18px rgba(91,91,214,0.30)',
                }}
              >
                <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.18)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 900, color: '#fff', margin: 0 }}>Seja Pro 🚀</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0, marginTop: 2 }}>A partir de R$ 10,83/mês</p>
                </div>
              </Link>
            )}

            {sheetItems.map(({ href, label, Icon, newKey }) => {
              const active = pathname === href;
              const showNew = !!newKey && newKeys.has(newKey);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    if (newKey) markFeatureSeen(newKey);
                    setSheetOpen(false);
                  }}
                  style={{ ...listItem, color: active ? 'var(--accent)' : 'var(--text)' }}
                >
                  <span style={listIconWrap}>
                    <Icon size={16} color={active ? 'var(--accent)' : 'var(--text-2)'} />
                  </span>
                  <span style={{ flex: 1 }}>{label}</span>
                  {showNew && (
                    <span style={{ background: 'var(--green)', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', marginRight: 4 }}>
                      Novo
                    </span>
                  )}
                  <ChevronRight size={16} color={active ? 'var(--accent)' : 'var(--text-3)'} />
                </Link>
              );
            })}

            {/* Sair */}
            <button
              type="button"
              onClick={() => { setSheetOpen(false); handleLogout(); }}
              style={{ ...listItem, color: 'var(--red)', borderBottom: 'none', borderTop: '1px solid var(--border)', marginTop: 4 }}
            >
              <span style={listIconWrap}><LogOut size={16} color="var(--red)" /></span>
              <span style={{ flex: 1 }}>Sair</span>
            </button>
          </div>
        </div>
      )}

      {/* ── OVERLAY do drawer ─────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[70] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── DRAWER LATERAL (desliza da esquerda) ─────────────────────────── */}
      <div
        className="lg:hidden"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
          zIndex: 71,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          // Edge-to-edge: header do drawer abaixo da Dynamic Island + base acima
          // do home indicator. Web: env=0 (sem efeito).
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 250ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                fontWeight: 800, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: '0 2px 6px var(--avatar-shadow)',
              }}
            >
              {initial}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {userName || 'Você'}
              </p>
              {/* Status do plano (backend é a fonte de verdade — vale web e nativo). */}
              {!subLoading && (
                <span
                  style={{
                    display: 'inline-block', marginTop: 2,
                    padding: '1px 7px', borderRadius: 999,
                    background: isPro ? 'var(--accent)' : 'var(--accent-bg)',
                    color: isPro ? '#fff' : 'var(--accent)',
                    fontSize: 10, fontWeight: 800,
                  }}
                >
                  {isPro ? 'PRO ✓' : 'Plano gratuito'}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'var(--bg)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={15} color="var(--text-2)" />
          </button>
        </div>

        {/* Navegação */}
        <div style={{ padding: '8px 8px' }}>
          {!subLoading && isFree && (
            <Link
              href="/upgrade"
              onClick={() => setDrawerOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                margin: '4px 0 8px',
                background: 'var(--accent)', borderRadius: 12,
                padding: '12px 14px', textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(91,91,214,0.28)',
              }}
            >
              <Sparkles size={16} color="#fff" />
              <p style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: 0 }}>Seja Pro 🚀</p>
            </Link>
          )}

          {sheetItems.map(({ href, label, Icon, newKey }) => {
            const active = pathname === href;
            const showNew = !!newKey && newKeys.has(newKey);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  if (newKey) markFeatureSeen(newKey);
                  setDrawerOpen(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 10px', borderRadius: 10,
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 14, fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'background 120ms',
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 8, background: active ? 'rgba(91,91,214,0.12)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={active ? 'var(--accent)' : 'var(--text-2)'} />
                </span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                {showNew && (
                  <span style={{ background: 'var(--green)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', flexShrink: 0 }}>
                    Novo
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
