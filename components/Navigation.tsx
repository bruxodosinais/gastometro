'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Plus, Clock, RefreshCw, LayoutGrid,
  Target, Bot, TrendingUp, UserCircle, X, CreditCard, Sparkles,
  MessageSquare, Rocket, Headphones,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { openFeedback } from '@/components/FeedbackButton';
import { openSupport } from '@/components/SupportButton';
import { MISSAO_FEATURE_KEY, markFeatureSeen, shouldShowNewBadge } from '@/lib/featureFlags';

const ACTIVE = 'var(--accent)';
const INACTIVE = '#9CA3AF';

// Itens expostos no sheet "Mais". `newKey` marca itens elegíveis ao selo NOVO
// (badge verde + auto-dismiss via featureFlags).
type SheetItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  newKey?: string;
};

const sheetItems: SheetItem[] = [
  { href: '/missao',      label: 'Missão de Poupança 🎯', Icon: Rocket,     newKey: MISSAO_FEATURE_KEY },
  { href: '/categorias',  label: 'Categorias',           Icon: LayoutGrid  },
  { href: '/metas',       label: 'Metas',                Icon: Target      },
  { href: '/cartoes',     label: 'Cartões',              Icon: CreditCard  },
  { href: '/patrimonio',  label: 'Patrimônio',           Icon: TrendingUp  },
  { href: '/assistente',  label: 'Assistente',           Icon: Bot         },
  { href: '/perfil',      label: 'Perfil',               Icon: UserCircle  },
];

export default function Navigation() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { isFree, loading: subLoading } = useSubscription();

  // Quais itens devem mostrar o selo NOVO. Estado pra evitar mismatch SSR
  // (localStorage só existe no cliente).
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const eligible = new Set<string>();
    for (const it of sheetItems) {
      if (it.newKey && shouldShowNewBadge(it.newKey)) eligible.add(it.newKey);
    }
    setNewKeys(eligible);
  }, [sheetOpen]); // reavalia ao abrir o sheet (caso outro tab tenha clicado)

  const maisActive = sheetItems.some((i) => i.href === pathname);

  return (
    <>
      {/* ── MOBILE: tab bar fixa ─────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid #F3F4F6',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center h-16 px-2">

          {/* Home */}
          {(() => {
            const active = pathname === '/';
            return (
              <Link href="/" className="flex flex-col items-center gap-0.5 flex-1 py-2">
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

          {/* Mais */}
          <button
            onClick={() => setSheetOpen(true)}
            className="flex flex-col items-center gap-0.5 flex-1 py-2"
          >
            <LayoutGrid size={24} strokeWidth={maisActive ? 2.5 : 1.8} color={maisActive ? ACTIVE : INACTIVE} />
            <span className="text-xs font-medium" style={{ color: maisActive ? ACTIVE : INACTIVE }}>Mais</span>
          </button>

        </div>
      </nav>

      {/* ── SHEET "MAIS" ─────────────────────────────────────────────────── */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              borderRadius: '20px 20px 0 0',
              background: 'var(--surface)',
              padding: '20px 16px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>Mais</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
                  Ferramentas e configurações
                </p>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <X size={16} color="var(--text-2)" />
              </button>
            </div>

            {/* Grid 2 colunas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'var(--surface)',
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--r)',
                      padding: '20px 16px',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 150ms',
                    }}
                  >
                    {showNew && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: 'var(--green)',
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          padding: '2px 6px',
                          borderRadius: 999,
                          textTransform: 'uppercase',
                        }}
                      >
                        Novo
                      </span>
                    )}
                    <div
                      style={{
                        width: 40, height: 40,
                        background: 'var(--accent-bg)',
                        borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon size={20} color="var(--accent)" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 10, textAlign: 'center' }}>
                      {label}
                    </span>
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  openFeedback();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r)',
                  padding: '20px 16px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 150ms',
                }}
              >
                <div
                  style={{
                    width: 40, height: 40,
                    background: 'var(--accent-bg)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <MessageSquare size={20} color="var(--accent)" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 10, textAlign: 'center' }}>
                  Enviar feedback
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  openSupport();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r)',
                  padding: '20px 16px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 150ms',
                }}
              >
                <div
                  style={{
                    width: 40, height: 40,
                    background: 'var(--accent-bg)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Headphones size={20} color="var(--accent)" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 10, textAlign: 'center' }}>
                  Suporte
                </span>
              </button>

              {!subLoading && isFree && (
                <Link
                  href="/upgrade"
                  onClick={() => setSheetOpen(false)}
                  style={{
                    gridColumn: 'span 2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'var(--accent)',
                    border: '1.5px solid var(--accent)',
                    borderRadius: 14,
                    padding: '16px 18px',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(91,91,214,0.30)',
                  }}
                >
                  <div
                    style={{
                      width: 44, height: 44,
                      background: 'rgba(255,255,255,0.18)',
                      borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={22} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: 0 }}>
                      Seja Pro 🚀
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0, marginTop: 2 }}>
                      A partir de R$ 19,90/mês
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
