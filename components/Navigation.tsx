'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, LayoutGrid, Clock, RefreshCw, Target } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/lancamentos', label: 'Lançar', Icon: PlusCircle },
  { href: '/categorias', label: 'Categorias', Icon: LayoutGrid },
  { href: '/historico', label: 'Histórico', Icon: Clock },
  { href: '/metas', label: 'Metas', Icon: Target },
  { href: '/recorrentes', label: 'Recorrentes', Icon: RefreshCw },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile: barra inferior scrollável */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 md:hidden">
        <div className="flex items-center overflow-x-auto scrollbar-none px-1 py-1.5 gap-0.5 max-w-lg mx-auto">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-colors flex-shrink-0 min-w-[54px] ${
                  active ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[9px] font-medium leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: sidebar lateral */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-50">
        <div className="px-6 py-6 border-b border-slate-800">
          <span className="text-xl font-bold text-white">
            Gastô<span className="text-violet-400">Metro</span>
          </span>
        </div>
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${
                  active
                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
