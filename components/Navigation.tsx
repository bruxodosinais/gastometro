'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, LayoutGrid, Clock, RefreshCw, Target, Bot, TrendingUp, UserCircle } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/lancamentos', label: 'Lançar', Icon: PlusCircle },
  { href: '/categorias', label: 'Categorias', Icon: LayoutGrid },
  { href: '/historico', label: 'Histórico', Icon: Clock },
  { href: '/metas', label: 'Metas', Icon: Target },
  { href: '/patrimonio', label: 'Patrimônio', Icon: TrendingUp },
  { href: '/recorrentes', label: 'Recorrentes', Icon: RefreshCw },
  { href: '/assistente', label: 'Assistente', Icon: Bot },
  { href: '/perfil', label: 'Perfil', Icon: UserCircle },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile: barra inferior scrollável */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 md:hidden">
        <div className="flex items-center overflow-x-auto scrollbar-none px-1 py-1.5 gap-0.5 max-w-lg mx-auto">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-colors flex-shrink-0 min-w-[54px] ${
                  active ? 'text-mint-500' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[9px] font-medium leading-tight tracking-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: sidebar lateral */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 z-50">
        <div className="px-6 py-6 border-b border-gray-100">
          <span className="text-xl font-bold text-gray-900">
            Gastô<span className="text-mint-500">Metro</span>
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
