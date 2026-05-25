'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { getCachedUser } from '@/lib/dataCache';
import {
  calcStreak,
  getAllUserBadges,
  getCompletedMissions,
  getContributions,
  getMission,
  type MissionContribution,
  type SavingsMission,
} from '@/lib/storage/missions';
import { BADGES, badgesByCategory, type BadgeDef } from '../../_components/missao/badges';
import { getMissionLevel, type BadgeCategory } from '@/lib/badges';
import BadgeDetailSheet from '../../_components/missao/BadgeDetailSheet';

type Tab = 'badges' | 'history';

// Rótulos visíveis das categorias de badge. A ordem das seções na grid é
// definida no JSX (streak → valor → missoes → comportamento).
const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  streak: 'Streak',
  valor: 'Valor acumulado',
  missoes: 'Missões',
  comportamento: 'Comportamento',
};

// Entrada da aba Histórico: a missão + dados derivados das contribuições
// (total guardado + data da última contribuição, que serve como "meta
// atingida em" para missões concluídas).
type HistoryEntry = {
  mission: SavingsMission;
  totalSaved: number;
  lastContributionAt: string | null;
};

function monthYearLabel(iso: string): string {
  const d = new Date(iso);
  // timeZone fixo em BRT: garante que timestamps UTC do banco (registered_at,
  // created_at) não atravessem fronteira de mês quando o browser está em
  // outro fuso. Sem isso, um aporte feito às 22h BRT em 31/05 vira "Jun"
  // para um browser em UTC.
  const raw = d
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' })
    .replace('.', '');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

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

function BadgesContent() {
  // Aba inicial vem de `?tab=historico` (deep link do modal de Histórico no
  // dashboard). Qualquer outro valor cai no default `badges`. Lazy init —
  // só roda uma vez no mount, depois o estado segue o usuário.
  const searchParams = useSearchParams();
  const [state, setState] = useState<UserState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BadgeDef | null>(null);
  const [tab, setTab] = useState<Tab>(() =>
    searchParams.get('tab') === 'historico' ? 'history' : 'badges',
  );

  const load = useCallback(async () => {
    const user = await getCachedUser();
    if (!user) { setLoading(false); return; }
    // Missão ativa + histórico + badges acumulados em paralelo.
    // getAllUserBadges é a fonte de verdade pro contador/grids — inclui
    // badges desbloqueados em missões antigas (pausadas/concluídas), que
    // o usuário não perde ao iniciar uma nova missão.
    const [m, completed, allBadgeKeys] = await Promise.all([
      getMission(user.id),
      getCompletedMissions(user.id),
      getAllUserBadges(user.id),
    ]);
    const unlockedKeys = new Set(allBadgeKeys);

    // Histórico: cada missão precisa do total guardado e da data da última
    // contribuição (= "Meta atingida em" pras concluídas). N+1 é aceitável
    // aqui — getContributions é cacheada e a lista de missões fechadas tende
    // a ser curta (1 dígito).
    const historyEntries: HistoryEntry[] = await Promise.all(
      completed.map(async (mis): Promise<HistoryEntry> => {
        const contribs = await getContributions(mis.id);
        const totalSaved = contribs.reduce((s, c) => s + Number(c.amount), 0);
        // getContributions vem ordenado desc por registered_at; o primeiro
        // item é a última contribuição.
        const lastContributionAt = contribs[0]?.registeredAt ?? null;
        return { mission: mis, totalSaved, lastContributionAt };
      }),
    );
    setHistory(historyEntries);

    if (!m) {
      setState({ mission: null, streak: 0, totalSaved: 0, contribCount: 0, unlockedKeys, unlockedAt: {} });
      setLoading(false);
      return;
    }
    const contribs = await getContributions(m.id);
    setState({
      mission: m,
      streak: calcStreak(contribs),
      totalSaved: contribs.reduce((s: number, c: MissionContribution) => s + Number(c.amount), 0),
      contribCount: contribs.length,
      unlockedKeys,
      unlockedAt: {},
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
  const byCategory = useMemo(() => badgesByCategory(), []);

  // Próximo: primeiro da grid bloqueada (ordem das BADGES = ordem de progressão).
  const next = locked[0];

  // Progresso da missão ativa → nível atual (5 faixas). Quando não há missão
  // ativa (usuário acessou /missao/badges sem missão criada), level fica null
  // e o card de XP é ocultado.
  const missionLevel = useMemo(() => {
    if (!state?.mission || state.mission.targetAmount <= 0) return null;
    const pct = Math.min(100, (state.totalSaved / state.mission.targetAmount) * 100);
    return { ...getMissionLevel(pct), progressPercent: pct };
  }, [state]);

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

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="px-5 pt-2 pb-1">
        <div
          role="tablist"
          className="inline-flex gap-2 rounded-full p-1"
          style={{ background: 'var(--bg)' }}
        >
          <TabPill active={tab === 'badges'} onClick={() => setTab('badges')}>
            Badges
          </TabPill>
          <TabPill active={tab === 'history'} onClick={() => setTab('history')}>
            Histórico
          </TabPill>
        </div>
      </div>

      {tab === 'history' ? (
        <HistoryTab entries={history} />
      ) : (
        <>

      {/* ── Card de XP por nível ───────────────────────────────────────── */}
      {/* Cinco faixas baseadas no progressPercent da missão ativa. Fica
          oculto quando o usuário não tem missão ativa (ex.: chegou aqui via
          deep link sem nunca ter criado missão). Fundo lilás conforme spec. */}
      {missionLevel && (
        <section className="px-5 pt-2">
          <div
            className="flex items-center gap-4 p-5"
            style={{ background: '#EEEDFC', borderRadius: 16 }}
          >
            <span className="text-[44px] leading-none">{missionLevel.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
                {missionLevel.label}
              </p>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: 'rgba(91,91,214,0.18)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${missionLevel.progressInLevel}%`,
                    background: '#5B5BD6',
                    transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs font-bold" style={{ color: '#6b7280' }}>
                {missionLevel.next
                  ? `${missionLevel.toNextPercent}% para o próximo nível`
                  : 'Você atingiu o nível máximo!'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Banner com donut ───────────────────────────────────────────── */}
      <section className="px-5 pt-3">
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

      {/* ── Badges por categoria ──────────────────────────────────────── */}
      {/* Substitui o split Desbloqueados/A conquistar — cada seção mostra
          todos os badges da categoria, com check verde nos desbloqueados.
          Ordem das seções espelha BadgeCategory: streak, valor, missoes,
          comportamento (que é a ordem natural de progressão na app). */}
      {(['streak', 'valor', 'missoes', 'comportamento'] as BadgeCategory[]).map((cat) => {
        const items = byCategory[cat];
        if (items.length === 0) return null;
        return (
          <section key={cat} className="px-5 pt-5">
            <p
              className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em]"
              style={{ color: '#6b7280' }}
            >
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {items.map((b) => {
                const isUnlocked = state?.unlockedKeys.has(b.key) ?? false;
                return (
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
                      className="flex h-14 w-14 items-center justify-center rounded-full"
                      style={{ background: isUnlocked ? 'var(--accent-bg)' : '#f3f4f6' }}
                    >
                      <span className="text-[26px] leading-none" style={{ opacity: isUnlocked ? 1 : 0.4 }}>
                        {b.emoji}
                      </span>
                    </div>
                    <p
                      className="mt-2 text-center text-[11px] font-extrabold leading-tight"
                      style={{ color: isUnlocked ? 'var(--text)' : 'var(--text-2)' }}
                    >
                      {b.name}
                    </p>
                    {isUnlocked && (
                      <span
                        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                        style={{ background: 'var(--green)', color: 'white' }}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

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

        </>
      )}

      <BadgeDetailSheet
        badge={active}
        unlockedAt={active && state ? state.unlockedAt[active.key] : undefined}
        onClose={() => setActive(null)}
      />
    </main>
  );
}

// useSearchParams força o pai a estar dentro de Suspense durante o build do
// Next 15 — caso contrário a página inteira falha com "should be wrapped in
// a suspense boundary". Mesmo padrão de missao/nova/page.tsx.
export default function BadgesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Carregando...</div>}>
      <BadgesContent />
    </Suspense>
  );
}

// ─── Pílula de aba ──────────────────────────────────────────────────────

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="rounded-full px-4 py-1.5 text-[12px] font-extrabold transition active:scale-95"
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-2)',
      }}
    >
      {children}
    </button>
  );
}

// ─── Aba Histórico ──────────────────────────────────────────────────────

function HistoryTab({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <section className="px-5 pt-6">
        <div
          className="flex flex-col items-center rounded-2xl px-6 py-10 text-center"
          style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--r)' }}
        >
          <span className="text-[44px] leading-none">🎯</span>
          <p className="mt-3 text-[14px] font-bold" style={{ color: 'var(--text-2)' }}>
            Nenhuma missão concluída ainda. Continue guardando!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 px-5 pt-4">
      {entries.map((e) => (
        <HistoryCard key={e.mission.id} entry={e} />
      ))}
    </section>
  );
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const { mission, totalSaved, lastContributionAt } = entry;
  const target = Number(mission.targetAmount);
  const pct = target > 0 ? Math.min(100, (totalSaved / target) * 100) : 0;
  const isCompleted = mission.status === 'completed';
  const barColor = isCompleted ? 'var(--green)' : 'var(--yellow)';

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--r)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="min-w-0 flex-1 truncate text-[15px] font-extrabold"
          style={{ color: 'var(--text)' }}
        >
          {mission.name}
        </p>
        <span
          className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold"
          style={{
            background: isCompleted ? 'var(--green-bg)' : 'var(--yellow-bg)',
            color: isCompleted ? 'var(--green-text)' : 'var(--yellow-text)',
          }}
        >
          {isCompleted ? 'Concluída ✓' : 'Pausada'}
        </span>
      </div>

      <p className="mt-2 text-[12px] font-bold" style={{ color: 'var(--text-2)' }}>
        {formatCurrency(totalSaved)} guardados de {formatCurrency(target)} · {Math.round(pct)}%
      </p>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--border-2)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>

      <div className="mt-3 flex flex-col gap-0.5 text-[11px] font-bold" style={{ color: 'var(--text-3)' }}>
        <span>Iniciada em {monthYearLabel(mission.createdAt)}</span>
        {isCompleted && lastContributionAt && (
          <span>Meta atingida em {monthYearLabel(lastContributionAt)}</span>
        )}
      </div>

      {isCompleted && (
        <Link
          href={`/missao/compartilhar?missionId=${mission.id}&name=${encodeURIComponent(mission.name)}&saved=${totalSaved}&months=${mission.months}&target=${target}`}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[12px] font-extrabold transition active:scale-95"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)', borderRadius: 'var(--r-sm)' }}
        >
          Compartilhar conquista 🎉
        </Link>
      )}
    </div>
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

