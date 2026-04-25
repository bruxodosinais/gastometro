'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, LayoutGrid, Clock } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/lancamentos', label: 'Lançar', Icon: PlusCircle },
  { href: '/categorias', label: 'Categorias', Icon: LayoutGrid },
  { href: '/historico', label: 'Histórico', Icon: Clock },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-colors ${
                active ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
