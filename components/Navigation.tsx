'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Plus, Clock, RefreshCw, LayoutGrid,
  Target, Bot, TrendingUp, UserCircle, X, CreditCard,
} from 'lucide-react';

const ACTIVE = 'var(--accent)';
const INACTIVE = '#9CA3AF';

// Itens expostos no sheet "Mais"
const sheetItems = [
  { href: '/categorias',  label: 'Categorias',  Icon: LayoutGrid  },
  { href: '/metas',       label: 'Metas',        Icon: Target      },
  { href: '/cartoes',     label: 'Cartões',      Icon: CreditCard  },
  { href: '/patrimonio',  label: 'Patrimônio',   Icon: TrendingUp  },
  { href: '/assistente',  label: 'Assistente',   Icon: Bot         },
  { href: '/perfil',      label: 'Perfil',       Icon: UserCircle  },
];

// Todos os itens para a sidebar desktop
const allTabs = [
  { href: '/',            label: 'Home',         Icon: Home        },
  { href: '/lancamentos', label: 'Lançar',       Icon: Plus        },
  { href: '/categorias',  label: 'Categorias',   Icon: LayoutGrid  },
  { href: '/historico',   label: 'Histórico',    Icon: Clock       },
  { href: '/metas',       label: 'Metas',        Icon: Target      },
  { href: '/cartoes',     label: 'Cartões',      Icon: CreditCard  },
  { href: '/patrimonio',  label: 'Patrimônio',   Icon: TrendingUp  },
  { href: '/recorrentes', label: 'Recorrentes',  Icon: RefreshCw   },
  { href: '/assistente',  label: 'Assistente',   Icon: Bot         },
  { href: '/perfil',      label: 'Perfil',       Icon: UserCircle  },
];

export default function Navigation() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const maisActive = sheetItems.some((i) => i.href === pathname);

  return (
    <>
      {/* ── MOBILE: tab bar fixa ─────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
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
          className="fixed inset-0 z-[60] md:hidden flex items-end justify-center"
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
              {sheetItems.map(({ href, label, Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSheetOpen(false)}
                    style={{
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
            </div>
          </div>
        </div>
      )}

      {/* ── DESKTOP: sidebar lateral (inalterada) ────────────────────────── */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 z-50">
        <div className="px-6 py-6 border-b border-gray-100">
          <span className="text-xl font-bold text-gray-900">
            Gastô<span className="text-mint-500">Metro</span>
          </span>
        </div>
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allTabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${
                  active
                    ? 'bg-mint-50 text-mint-500 border border-mint-500/20'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
