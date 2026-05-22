'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Lock, Check, X } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { getCachedUser } from '@/lib/dataCache';
import {
  calcStreak,
  getBadges,
  getContributions,
  getMission,
  type MissionBadge,
  type SavingsMission,
} from '@/lib/storage/missions';
import { BADGES, type BadgeDef } from '../../_components/missao/badges';

// Estado do usuário relativo a cada badge — usado pra calcular o "próximo".
type UserState = {
  mission: SavingsMission | null;
  streak: number;
  totalSaved: number;
  contribCount: number;
  unlockedKeys: Set<string>;
  unlockedAt: Record<string, string>;
};

function distanceFor(def: BadgeDef, s: UserState): string {
  switch (def.key) {
    case 'primeiro_passo':
      return 'Faça seu primeiro depósito';
    case 'consistente':
      return `Faltam ${Math.max(0, 3 - s.streak)} meses seguidos`;
    case 'meio_caminho': {
      const target = s.mission?.targetAmount ?? 0;
      const missing = Math.max(0, target * 0.5 - s.totalSaved);
      return `Faltam ${formatCurrency(missing)} para 50%`;
    }
    case 'expert':
      return `Faltam ${Math.max(0, 6 - s.streak)} meses seguidos`;
    case 'meta_batida': {
      const target = s.mission?.targetAmount ?? 0;
      const missing = Math.max(0, target - s.totalSaved);
      return `Faltam ${formatCurrency(missing)} para bater a meta`;
    }
    case 'mestre_clt':
      return 'Complete mais missões';
    default:
      return '';
  }
}

export default function BadgesPage() {
  const [state, setState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BadgeDef | null>(null);

  const load = useCallback(async () => {
    const user = await getCachedUser();
    if (!user) { setLoading(false); return; }
    const m = await getMission(user.id);
    if (!m) {
      setState({ mission: null, streak: 0, totalSaved: 0, contribCount: 0, unlockedKeys: new Set(), unlockedAt: {} });
      setLoading(false);
      return;
    }
    const [contribs, badges] = await Promise.all([
      getContributions(m.id),
      getBadges(user.id, m.id),
    ]);
    const unlockedKeys = new Set(badges.map((b: MissionBadge) => b.badgeKey));
    const unlockedAt = Object.fromEntries(badges.map((b) => [b.badgeKey, b.unlockedAt]));
    setState({
      mission: m,
      streak: calcStreak(contribs),
      totalSaved: contribs.reduce((s, c) => s + Number(c.amount), 0),
      contribCount: contribs.length,
      unlockedKeys,
      unlockedAt,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const unlocked = useMemo(
    () => (state ? BADGES.filter((b) => state.unlockedKeys.has(b.key)) : []),
    [state],
  );
  const locked = useMemo(
    () => (state ? BADGES.filter((b) => !state.unlockedKeys.has(b.key)) : []),
    [state],
  );

  // Próximo: primeiro da grid bloqueada (ordem das BADGES = ordem de progressão).
  const next = locked[0];

  if (loading) {
    return (
      <main
        className="mx-auto flex min-h-screen w-full items-center justify-center"
        style={{ maxWidth: 390, background: 'var(--bg)' }}
      >
        <Loader2 className="animate-spin" color="var(--accent)" />
      </main>
    );
  }

  return (
    <main
      className="mx-auto w-full pb-10"
      style={{ maxWidth: 390, background: 'var(--bg)', minHeight: '100vh' }}
    >
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <Link
          href="/missao/dashboard"
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: 'var(--surface)', boxShadow: 'var(--hbtn-shadow)' }}
        >
          <ArrowLeft size={20} color="var(--text)" />
        </Link>
        <h1 className="text-[17px] font-extrabold" style={{ color: 'var(--text)' }}>
          Suas conquistas
        </h1>
      </header>

      {/* ── Banner com donut ───────────────────────────────────────────── */}
      <section className="px-5 pt-2">
        <div
          className="flex items-center gap-4 rounded-2xl p-5"
          style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--r)' }}
        >
          <Donut total={BADGES.length} done={unlocked.length} />
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
              {unlocked.length} de {BADGES.length}
            </p>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-2)' }}>
              badges desbloqueados
            </p>
          </div>
        </div>
      </section>

      {/* ── Desbloqueados ──────────────────────────────────────────────── */}
      {unlocked.length > 0 && (
        <section className="px-5 pt-5">
          <p
            className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-3)' }}
          >
            Desbloqueados
          </p>
          <div className="grid grid-cols-3 gap-3">
            {unlocked.map((b) => (
              <button
                key={b.key}
                onClick={() => setActive(b)}
                className="relative flex flex-col items-center rounded-2xl p-3 transition active:scale-95"
                style={{
                  background: 'var(--surface)',
                  boxShadow: 'var(--card-shadow)',
                  borderRadius: 'var(--r)',
                }}
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-[26px]"
                  style={{ background: 'var(--accent-bg)' }}
                >
                  {b.emoji}
                </div>
                <p
                  className="mt-2 text-center text-[11px] font-extrabold leading-tight"
                  style={{ color: 'var(--text)' }}
                >
                  {b.name}
                </p>
                <span
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: 'var(--green)', color: 'white' }}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Bloqueados ─────────────────────────────────────────────────── */}
      {locked.length > 0 && (
        <section className="px-5 pt-5">
          <p
            className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-3)' }}
          >
            A conquistar
          </p>
          <div className="grid grid-cols-3 gap-3">
            {locked.map((b) => (
              <div
                key={b.key}
                className="flex flex-col items-center rounded-2xl p-3"
                style={{
                  background: 'var(--surface)',
                  boxShadow: 'var(--card-shadow)',
                  borderRadius: 'var(--r)',
                  opacity: 0.6,
                }}
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: 'var(--bg)' }}
                >
                  <Lock size={20} color="var(--text-3)" />
                </div>
                <p
                  className="mt-2 text-center text-[11px] font-extrabold leading-tight"
                  style={{ color: 'var(--text-2)' }}
                >
                  {b.name}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Banner próximo badge ──────────────────────────────────────── */}
      {next && state && (
        <section className="px-5 pt-6">
          <div
            className="flex items-start gap-3 rounded-2xl p-4"
            style={{ background: 'var(--yellow-bg)', borderRadius: 'var(--r)' }}
          >
            <span className="text-[26px] leading-none">{next.emoji}</span>
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.12em]"
                style={{ color: 'var(--yellow-text)' }}
              >
                Próximo badge
              </p>
              <p className="text-[14px] font-extrabold" style={{ color: 'var(--text)' }}>
                {next.name}
              </p>
              <p className="text-[12px] font-bold" style={{ color: 'var(--yellow-text)' }}>
                {distanceFor(next, state)}
              </p>
            </div>
          </div>
        </section>
      )}

      <BadgeDetailSheet
        badge={active}
        unlockedAt={active && state ? state.unlockedAt[active.key] : undefined}
        onClose={() => setActive(null)}
      />
    </main>
  );
}

// ─── Donut SVG simples ──────────────────────────────────────────────────

function Donut({ total, done }: { total: number; done: number }) {
  const size = 56;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - done / total);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ─── Sheet de detalhe ───────────────────────────────────────────────────

function BadgeDetailSheet({
  badge,
  unlockedAt,
  onClose,
}: {
  badge: BadgeDef | null;
  unlockedAt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!badge) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [badge]);

  if (!badge) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{ maxWidth: 390 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 pt-4 pb-7"
          style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0' }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.12em]"
              style={{ color: 'var(--accent)' }}
            >
              Badge
            </span>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'var(--bg)' }}
            >
              <X size={16} color="var(--text-2)" />
            </button>
          </div>

          <div className="mt-3 flex flex-col items-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-[44px]"
              style={{ background: 'var(--accent-bg)' }}
            >
              {badge.emoji}
            </div>
            <h3 className="mt-3 text-[20px] font-extrabold" style={{ color: 'var(--text)' }}>
              {badge.name}
            </h3>
            <p
              className="mt-2 max-w-[280px] text-center text-[14px] font-medium leading-snug"
              style={{ color: 'var(--text-2)' }}
            >
              {badge.description}
            </p>
            {unlockedAt && (
              <p
                className="mt-3 rounded-full px-3 py-1 text-[11px] font-extrabold"
                style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
              >
                Desbloqueado em {new Date(unlockedAt).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
