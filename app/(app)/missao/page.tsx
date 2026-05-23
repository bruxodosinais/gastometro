'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getMission } from '@/lib/storage/missions';
import { getCachedUser } from '@/lib/dataCache';
import PulseTarget from '../_components/missao/PulseTarget';

const SUGGESTIONS: { emoji: string; name: string }[] = [
  { emoji: '🎯', name: 'Meu primeiro R$ 10k' },
  { emoji: '🛡️', name: 'Reserva de emergência' },
  { emoji: '✈️', name: 'Viagem dos sonhos' },
  { emoji: '🏠', name: 'Entrada do apartamento' },
];

export default function MissaoPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCachedUser();
      if (!user) {
        if (!cancelled) setChecking(false);
        return;
      }
      const mission = await getMission(user.id);
      if (cancelled) return;
      if (mission) router.replace('/missao/dashboard');
      else setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (checking) {
    return (
      <main
        className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 flex min-h-screen w-full items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <Loader2 className="animate-spin" color="var(--accent)" />
      </main>
    );
  }

  return (
    <main
      className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 w-full"
      style={{ background: 'var(--bg)', minHeight: '100vh' }}
    >
      <header className="flex items-center gap-3 pt-5 pb-2">
        <Link
          href="/"
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: 'var(--surface)', boxShadow: 'var(--hbtn-shadow)' }}
        >
          <ArrowLeft size={20} color="var(--text)" />
        </Link>
        <h1 className="text-[17px] font-bold" style={{ color: 'var(--text)' }}>
          Missão de Poupança
        </h1>
      </header>

      <section className="flex flex-col items-center pt-6">
        <PulseTarget />

        <h2
          className="mt-6 text-center text-[24px] font-extrabold leading-tight"
          style={{ color: 'var(--text)' }}
        >
          Qual é o seu grande objetivo?
        </h2>
        <p
          className="mt-2 max-w-[280px] text-center text-[14px] font-medium leading-snug"
          style={{ color: 'var(--text-2)' }}
        >
          Defina uma meta e a gente te ajuda a guardar todo mês — com lembretes
          e desafios pra acelerar o caminho.
        </p>
      </section>

      <section className="pt-8">
        <p
          className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-3)' }}
        >
          Comece por aqui
        </p>

        <div className="grid grid-cols-2 gap-3">
          {SUGGESTIONS.map((s) => (
            <Link
              key={s.name}
              href={`/missao/nova?nome=${encodeURIComponent(s.name)}`}
              className="flex flex-col items-start gap-2 rounded-2xl p-4 transition active:scale-[0.98]"
              style={{
                background: 'var(--surface)',
                boxShadow: 'var(--card-shadow)',
                borderRadius: 'var(--r)',
                minHeight: 104,
              }}
            >
              <span className="text-[28px] leading-none">{s.emoji}</span>
              <span
                className="text-[13px] font-bold leading-tight"
                style={{ color: 'var(--text)' }}
              >
                {s.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="pt-8 pb-10">
        <Link
          href="/missao/nova"
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white transition active:scale-[0.98]"
          style={{
            background: 'var(--accent)',
            borderRadius: 'var(--r)',
            boxShadow: '0 6px 20px var(--accent-shadow)',
          }}
        >
          Criar minha missão
          <ChevronRight size={18} />
        </Link>
      </section>
    </main>
  );
}
