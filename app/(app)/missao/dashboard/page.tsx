'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, MoreVertical, Plus, Sparkles, X } from 'lucide-react';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { getCachedUser } from '@/lib/dataCache';
import {
  acceptChallenge as apiAcceptChallenge,
  calcStreak,
  completeMission,
  dismissChallenge as apiDismissChallenge,
  getBadges,
  getChallenges,
  getCompletedMissions,
  getCompletedMissionsCount,
  getContributions,
  getMission,
  pauseMission,
  unlockBadge,
  type MissionChallenge,
  type MissionContribution,
  type SavingsMission,
} from '@/lib/storage/missions';
import { claimReachedGoalMilestones } from '@/lib/gamification/goalMilestones';
import { completeChallenge } from '@/lib/gamification/challenges';
import { useSubscription } from '@/hooks/useSubscription';
import ContributionSheet from '../../_components/missao/ContributionSheet';
import MilestoneModal, { type MilestoneKind } from '../../_components/missao/MilestoneModal';
import BadgeDetailSheet from '../../_components/missao/BadgeDetailSheet';
import { BADGES, QUARTER_BADGE_KEY, type BadgeDef } from '../../_components/missao/badges';
import { getMissionLevel } from '@/lib/badges';

// Milestones (% → badge_key). Ordem decrescente: ao detectar cruzamento,
// processamos o maior primeiro para mostrar a celebração mais alta.
const MILESTONES: { pct: MilestoneKind; key: string }[] = [
  { pct: 100, key: 'meta_batida' },
  { pct: 50, key: 'meio_caminho' },
  { pct: 25, key: QUARTER_BADGE_KEY },
];

function monthLabelLong(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const month = d.toLocaleDateString('pt-BR', { month: 'long' });
  return month.charAt(0).toUpperCase() + month.slice(1);
}

// Header de grupo de mês: "Maio de 2026". Parseia YYYY-MM com
// new Date(y, m-1, 1) (hora local) — evita o pitfall do new Date('2026-05'),
// que seria UTC midnight e poderia voltar pro mês anterior em America/Sao_Paulo.
function monthHeaderLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const monthLong = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${monthLong.charAt(0).toUpperCase()}${monthLong.slice(1)} de ${y}`;
}

function projectedMonthLabel(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  const month = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} de ${d.getFullYear()}`;
}

// Missão histórica + total guardado. Calculado uma vez no loadAll a partir
// das contribuições da missão, evitando refazer a soma em cada render.
type PastMissionEntry = {
  mission: SavingsMission;
  totalSaved: number;
};

// Agrupa contribuições por mês YYYY-MM, retorna lista ordenada desc por mês.
function groupByMonth(contribs: MissionContribution[]) {
  const map = new Map<string, MissionContribution[]>();
  for (const c of contribs) {
    const list = map.get(c.month);
    if (list) list.push(c);
    else map.set(c.month, [c]);
  }
  return Array.from(map.entries())
    .map(([month, items]) => ({
      month,
      items,
      total: items.reduce((s, i) => s + Number(i.amount), 0),
      count: items.length,
    }))
    .sort((a, b) => (a.month > b.month ? -1 : 1));
}

export default function MissaoDashboardPage() {
  const router = useRouter();
  const { isPro } = useSubscription();

  const [userId, setUserId] = useState<string | null>(null);
  const [mission, setMission] = useState<SavingsMission | null>(null);
  const [contributions, setContributions] = useState<MissionContribution[]>([]);
  const [badges, setBadges] = useState<string[]>([]);   // só os badge_keys
  const [badgeUnlockedAt, setBadgeUnlockedAt] = useState<Record<string, string>>({});
  const [challenge, setChallenge] = useState<MissionChallenge | null>(null);
  // Missões anteriores (status completed/paused), com o total guardado por
  // missão derivado das contribuições. Vazio quando não há histórico.
  const [pastMissions, setPastMissions] = useState<PastMissionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  // M4: quando != null, o aporte em andamento conclui este desafio ao salvar.
  const [completingChallengeId, setCompletingChallengeId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Modais de acesso rápido (atalhos abaixo do header). Distintos do
  // `historyOpen` acima, que abre o modal de depósitos.
  const [conquistasModalOpen, setConquistasModalOpen] = useState(false);
  const [historicoMissoesOpen, setHistoricoMissoesOpen] = useState(false);
  const [milestone, setMilestone] = useState<{ kind: MilestoneKind; badgeKey?: string } | null>(null);
  const [activeBadge, setActiveBadge] = useState<BadgeDef | null>(null);
  const [completing, setCompleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [swapConfirmOpen, setSwapConfirmOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora ou apertar ESC. Sem isso, o menu fica
  // grudado quando o usuário toca em qualquer área da página.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Anima a barra de progresso (0→pct) ao montar com transition CSS.
  const [barReady, setBarReady] = useState(false);
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setBarReady(true), 50);
    return () => clearTimeout(t);
  }, [loading]);

  const loadAll = useCallback(async () => {
    const user = await getCachedUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // Missão ativa e histórico de missões em paralelo — getMission e
    // getCompletedMissions são cacheadas, sem custo extra na maioria dos casos.
    const [m, completed] = await Promise.all([
      getMission(user.id),
      getCompletedMissions(user.id),
    ]);

    // Calcula totalSaved de cada missão histórica via getContributions
    // (cacheada por missionId). N+1 aceitável: lista de missões fechadas
    // é tipicamente curta.
    const past: PastMissionEntry[] = await Promise.all(
      completed.map(async (pm): Promise<PastMissionEntry> => {
        const cs = await getContributions(pm.id);
        const totalSaved = cs.reduce((s, c) => s + Number(c.amount), 0);
        return { mission: pm, totalSaved };
      }),
    );
    setPastMissions(past);

    if (!m) {
      setMission(null);
      setLoading(false);
      return;
    }
    setMission(m);

    const [contribs, bdgs, chls] = await Promise.all([
      getContributions(m.id),
      getBadges(user.id, m.id),
      getChallenges(m.id, getMonthKey(new Date())),
    ]);
    setContributions(contribs);
    setBadges(bdgs.map((b) => b.badgeKey));
    setBadgeUnlockedAt(Object.fromEntries(bdgs.map((b) => [b.badgeKey, b.unlockedAt])));
    setChallenge(chls[0] ?? null);
    setLoading(false);

    // M2: reivindica marcos de meta (25/50/75/100%) atingidos. loadAll roda no
    // mount E após cada aporte (via handleSaved → loadAll), cobrindo os dois
    // momentos. Server-authoritative + idempotente; fire-and-forget. O recompute
    // do servidor é a autoridade — o pct daqui só decide quais marcos tentar.
    const saved = contribs.reduce((s, c) => s + Number(c.amount), 0);
    const pct = m.targetAmount > 0 ? Math.min(100, (saved / m.targetAmount) * 100) : 0;
    claimReachedGoalMilestones(m.id, pct).catch(() => {});
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Sem missão ativa → manda pro funil de criação.
  useEffect(() => {
    if (!loading && !mission) router.replace('/missao');
  }, [loading, mission, router]);

  // ─── Derivados ──────────────────────────────────────────────────────────
  const totalSaved = useMemo(
    () => contributions.reduce((s, c) => s + Number(c.amount), 0),
    [contributions],
  );
  const target = mission?.targetAmount ?? 0;
  const monthlyTarget = mission?.monthlyTarget ?? 0;
  const progressPercent = target > 0 ? Math.min(100, (totalSaved / target) * 100) : 0;
  const streak = useMemo(() => calcStreak(contributions), [contributions]);
  // Nível agora segue o progresso da missão (0–24, 25–49, 50–74, 75–99, 100).
  // Cinco faixas exibidas como chip no header + linha de "próximo nível"
  // logo abaixo da barra de progresso.
  const level = useMemo(() => getMissionLevel(progressPercent), [progressPercent]);

  const currentMonthKey = getMonthKey(new Date());
  const contribsThisMonth = useMemo(
    () => contributions.filter((c) => c.month === currentMonthKey),
    [contributions, currentMonthKey],
  );
  const totalThisMonth = contribsThisMonth.reduce((s, c) => s + Number(c.amount), 0);

  const grouped = useMemo(() => groupByMonth(contributions), [contributions]);
  const recentGroups = grouped.slice(0, 3);

  const monthsToFinish = useMemo(() => {
    if (totalSaved >= target) return 0;
    if (monthlyTarget <= 0) return null;
    return Math.ceil((target - totalSaved) / monthlyTarget);
  }, [target, totalSaved, monthlyTarget]);

  // ─── Side-effects: badges silenciosos + milestones ─────────────────────
  // Roda após cada loadAll. Idempotente via UNIQUE constraint no banco.
  useEffect(() => {
    if (!mission || !userId) return;
    const haveSet = new Set(badges);
    const eligibleSilent: string[] = [];
    if (contributions.length >= 1 && !haveSet.has('primeiro_passo')) eligibleSilent.push('primeiro_passo');
    if (streak >= 3 && !haveSet.has('consistente')) eligibleSilent.push('consistente');
    if (streak >= 6 && !haveSet.has('expert')) eligibleSilent.push('expert');
    if (eligibleSilent.length > 0) {
      Promise.all(eligibleSilent.map((k) => unlockBadge(userId, mission.id, k))).catch(() => {});
    }
  }, [badges, contributions.length, mission, streak, userId]);

  // Mostra MilestoneModal ao detectar cruzamento de marco ainda não registrado
  // no DB. Como o DB tem UNIQUE, isso só dispara uma vez por missão.
  // Após meta_batida, encadeia mestre_clt se já houver ≥2 missões fechadas.
  // Recebe newTotalSaved explícito: a verificação roda logo após addContribution,
  // antes do setState do loadAll() refletir no closure desta callback.
  const triggerMilestoneIfAny = useCallback(async (newTotalSaved: number) => {
    if (!mission || !userId) return;
    const newPercent = mission.targetAmount > 0
      ? Math.min(100, (newTotalSaved / mission.targetAmount) * 100)
      : 0;
    const haveSet = new Set(badges);
    for (const ms of MILESTONES) {
      if (newPercent >= ms.pct && !haveSet.has(ms.key)) {
        await unlockBadge(userId, mission.id, ms.key);
        setBadges((b) => [...b, ms.key]);
        setMilestone({
          kind: ms.pct,
          badgeKey: ms.key === QUARTER_BADGE_KEY ? undefined : ms.key,
        });

        if (ms.key === 'meta_batida' && !haveSet.has('mestre_clt')) {
          // Conta só missões com status='completed' — a missão atual segue
          // 'active' a 100% até ser fechada explicitamente, então este badge
          // depende de o usuário fechar a missão (rota não implementada nesta
          // etapa). Mantemos o gate exatamente como especificado.
          const completed = await getCompletedMissionsCount(userId);
          if (completed >= 2) {
            await unlockBadge(userId, mission.id, 'mestre_clt');
            setBadges((b) => [...b, 'mestre_clt']);
          }
        }
        return; // só um marco por vez
      }
    }
  }, [badges, mission, userId]);

  const handleSaved = useCallback(async (amount: number) => {
    const newTotalSaved = totalSaved + amount;
    await loadAll();
    await triggerMilestoneIfAny(newTotalSaved);
    // M4: se o aporte concluiu um desafio, marca concluído + credita +100.
    // O aporte já deu +50 (M1) e os marcos da meta já rodaram acima — o
    // CoinToast empilha "💰 Aporte +50" e "🤖 Desafio concluído! +100".
    if (completingChallengeId) {
      const res = await completeChallenge(completingChallengeId);
      if (res.ok) setChallenge((c) => (c ? { ...c, completed: true } : c));
      setCompletingChallengeId(null);
    }
  }, [loadAll, totalSaved, triggerMilestoneIfAny, completingChallengeId]);

  const handleAcceptChallenge = async () => {
    if (!challenge) return;
    await apiAcceptChallenge(challenge.id);
    setChallenge({ ...challenge, accepted: true });
  };

  const handleDismissChallenge = async () => {
    if (!challenge) return;
    await apiDismissChallenge(challenge.id);
    setChallenge(null);
  };

  // Fecha a missão atual (status='completed') antes de navegar pro funil de
  // criação. Evita que o usuário fique com duas missões ativas e libera o
  // gate do badge `mestre_clt` (≥2 missões completed).
  const handleStartNewMission = useCallback(async () => {
    if (!mission || completing) return;
    setCompleting(true);
    try {
      await completeMission(mission.id);
      router.push('/missao/nova');
    } catch (e) {
      console.error(e);
      setCompleting(false);
    }
  }, [completing, mission, router]);

  // "Trocar missão": pausa a atual em vez de completar — progresso fica salvo,
  // mas libera o slot active pro funil de criação.
  const handleSwapMission = useCallback(async () => {
    if (!mission || swapping) return;
    setSwapping(true);
    try {
      await pauseMission(mission.id);
      router.push('/missao/nova');
    } catch (e) {
      console.error(e);
      setSwapping(false);
    }
  }, [mission, router, swapping]);

  if (loading) {
    return (
      <main
        className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6 flex min-h-screen w-full items-center justify-center"
      >
        <Loader2 className="animate-spin" color="var(--accent)" />
      </main>
    );
  }

  if (!mission) return null;

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 pb-3">
        <Link
          href="/app"
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: 'var(--surface)', boxShadow: 'var(--hbtn-shadow)' }}
        >
          <ArrowLeft size={20} color="var(--text)" />
        </Link>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-3)' }}
          >
            Sua missão
          </p>
          <h1
            className="truncate text-[16px] font-extrabold leading-tight"
            style={{ color: 'var(--text)' }}
          >
            {mission.name}
          </h1>
        </div>
        <Link
          href="/missao/badges"
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-extrabold"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
        >
          <span>{level.emoji}</span>
          <span>{level.label}</span>
        </Link>
        {/* Menu ⋯: ficou à direita do badge de nível pra não competir com
            o botão voltar à esquerda. relative+absolute pra ancorar o popover
            no canto direito sem depender de portal. */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Mais opções"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--surface)', boxShadow: 'var(--hbtn-shadow)' }}
          >
            <MoreVertical size={18} color="var(--text)" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-12 z-30 w-48 overflow-hidden rounded-2xl"
              style={{
                background: 'var(--surface)',
                boxShadow: 'var(--card-shadow), 0 8px 24px rgba(0,0,0,0.12)',
                borderRadius: 'var(--r-sm)',
              }}
            >
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setSwapConfirmOpen(true);
                }}
                className="flex w-full items-center px-4 py-3 text-left text-[13px] font-bold transition active:scale-[0.98]"
                style={{ color: 'var(--text)' }}
              >
                Trocar missão
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Card progresso ─────────────────────────────────────────────── */}
      <section className="pt-2">
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--r)' }}
        >
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                style={{ color: 'var(--text-3)' }}
              >
                Progresso
              </p>
              <p className="mt-1 text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
                {formatCurrency(totalSaved)}{' '}
                <span className="text-[14px] font-bold" style={{ color: 'var(--text-2)' }}>
                  / {formatCurrency(target)}
                </span>
              </p>
            </div>
            <span className="text-[22px] font-extrabold" style={{ color: 'var(--accent)' }}>
              {progressPercent.toFixed(0)}%
            </span>
          </div>

          <div
            className="relative mt-4 h-3 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--border-2)' }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                width: `${barReady ? progressPercent : 0}%`,
                background: 'linear-gradient(90deg, #5B5BD6, #7C7CE8)',
                transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[10px] font-bold" style={{ color: 'var(--text-3)' }}>
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>🏁</span>
          </div>

          {/* Linha de próximo nível. No topo (level.next === null), troca
              para a mensagem de conclusão. text-xs #6b7280 conforme spec. */}
          <p className="mt-3 text-xs font-bold" style={{ color: '#6b7280' }}>
            {level.next
              ? <>Próximo nível: <span>{level.next.emoji}</span> {level.next.label} · faltam {level.toNextPercent}%</>
              : <>🏆 Missão completa!</>}
          </p>
        </div>
      </section>

      {/* ── Card streak ────────────────────────────────────────────────── */}
      <section className="pt-3">
        {streak >= 2 ? (
          <div
            className="flex items-center gap-3 rounded-2xl p-4"
            style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--r)' }}
          >
            <span className="text-[28px] leading-none">🔥</span>
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold" style={{ color: 'var(--text)' }}>
                {streak} meses consecutivos
              </p>
              <p className="text-[12px] font-bold" style={{ color: 'var(--text-2)' }}>
                Não quebra agora!
              </p>
            </div>
          </div>
        ) : streak === 0 ? (
          <div
            className="flex items-center gap-3 rounded-2xl p-4"
            style={{ background: 'var(--accent-bg)', borderRadius: 'var(--r)' }}
          >
            <span className="text-[24px] leading-none">✨</span>
            <p className="text-[14px] font-extrabold" style={{ color: 'var(--accent)' }}>
              Registre seu primeiro depósito!
            </p>
          </div>
        ) : null}
      </section>

      {/* ── Card desafio IA ────────────────────────────────────────────── */}
      {challenge && (
        <section className="pt-3">
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-soft)',
              borderRadius: 'var(--r)',
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} color="var(--accent)" />
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.12em]"
                style={{ color: 'var(--accent)' }}
              >
                Desafio de {monthLabelLong(challenge.month)} · IA
              </p>
            </div>
            <p
              className="mt-2 text-[14px] font-bold leading-snug"
              style={{ color: 'var(--text)' }}
            >
              {challenge.challengeText}
            </p>
            {challenge.potentialSavings && challenge.potentialSavings > 0 && (
              <p className="mt-1 text-[12px] font-bold" style={{ color: 'var(--accent)' }}>
                Economia estimada: {formatCurrency(Number(challenge.potentialSavings))}
              </p>
            )}
            {!challenge.accepted ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleAcceptChallenge}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl text-[13px] font-extrabold text-white"
                  style={{ background: 'var(--accent)', borderRadius: 'var(--r-sm)' }}
                >
                  Aceitar desafio
                </button>
                <button
                  onClick={handleDismissChallenge}
                  className="text-[13px] font-bold"
                  style={{ color: 'var(--text-2)' }}
                >
                  Agora não
                </button>
              </div>
            ) : challenge.completed ? (
              <p
                className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold"
                style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
              >
                <Check size={12} /> Desafio concluído
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setCompletingChallengeId(challenge.id);
                    setSheetOpen(true);
                  }}
                  className="flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-extrabold text-white"
                  style={{ background: 'var(--accent)', borderRadius: 'var(--r-sm)' }}
                >
                  {challenge.potentialSavings && challenge.potentialSavings > 0
                    ? `Concluir desafio · guardar ${formatCurrency(Number(challenge.potentialSavings))}`
                    : 'Concluir desafio'}
                </button>
                <p
                  className="inline-flex items-center justify-center gap-1 text-[11px] font-bold"
                  style={{ color: 'var(--text-3)' }}
                >
                  <Check size={12} /> Desafio aceito
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Card projeção ──────────────────────────────────────────────── */}
      <section className="pt-3">
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--r)' }}
        >
          {monthsToFinish === 0 ? (
            <p className="text-[14px] font-bold" style={{ color: 'var(--green-text)' }}>
              🏆 Você já bateu a meta — parabéns!
            </p>
          ) : monthsToFinish == null ? (
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-2)' }}>
              📅 Configure um valor mensal para projetarmos sua data.
            </p>
          ) : (
            <>
              <p className="text-[14px] font-bold leading-snug" style={{ color: 'var(--text)' }}>
                📅 No ritmo atual, você atinge a meta em{' '}
                <span style={{ color: 'var(--accent)' }}>
                  {projectedMonthLabel(monthsToFinish)}
                </span>.
              </p>
              {challenge?.accepted && (
                <p className="mt-1 text-[13px] font-bold" style={{ color: 'var(--green-text)' }}>
                  ⚡ Com o desafio, chega mais cedo.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Lista de contribuições ─────────────────────────────────────── */}
      <section className="pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
            style={{ color: 'var(--text-3)' }}
          >
            Depósitos
          </p>
          {grouped.length > 0 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-[12px] font-extrabold"
              style={{ color: 'var(--accent)' }}
            >
              Ver tudo →
            </button>
          )}
        </div>

        {recentGroups.length === 0 ? (
          <div
            className="rounded-2xl p-5 text-center text-[13px] font-bold"
            style={{ background: 'var(--surface)', color: 'var(--text-2)', borderRadius: 'var(--r)' }}
          >
            Nenhum depósito ainda.
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--r)' }}
          >
            {recentGroups.map((g, idx) => {
              const hit = g.total >= monthlyTarget && monthlyTarget > 0;
              return (
                <div
                  key={g.month}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-2)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold" style={{ color: 'var(--text)' }}>
                      {monthHeaderLabel(g.month)}
                    </p>
                    <p className="text-[11px] font-bold" style={{ color: 'var(--text-3)' }}>
                      {g.count} {g.count === 1 ? 'depósito' : 'depósitos'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold" style={{ color: 'var(--text)' }}>
                      {formatCurrency(g.total)}
                    </span>
                    {hit && (
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Atalhos: Conquistas + Histórico ────────────────────────────── */}
      {/* Logo após os Depósitos e antes do CTA principal — atalhos pros
          modais focados de badges e missões anteriores. */}
      <div className="flex gap-3 pt-4">
        <QuickAccessButton
          emoji="🏅"
          label="Conquistas"
          onClick={() => setConquistasModalOpen(true)}
        />
        <QuickAccessButton
          emoji="📋"
          label="Histórico"
          onClick={() => setHistoricoMissoesOpen(true)}
        />
      </div>

      {/* ── Bottom action ──────────────────────────────────────────────── */}
      {/* Inline ao final do conteúdo (não fixed): o app não usa FAB em
          nenhuma outra página, então seguir o fluxo evita inventar padrão
          novo e remove o problema de alinhamento com o sidebar do desktop.
          Pós-100%: oferecemos fechar e criar uma nova missão como ação
          primária, mantendo o depósito disponível para quem quiser passar
          do target. */}
      <section className="pt-6">
        {progressPercent >= 100 ? (
          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
            <button
              onClick={handleStartNewMission}
              disabled={completing}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'var(--accent)',
                boxShadow: '0 10px 30px var(--plus-shadow)',
              }}
            >
              {completing ? <Loader2 className="animate-spin" size={18} /> : 'Criar nova missão'}
            </button>
            <button
              onClick={() => { setCompletingChallengeId(null); setSheetOpen(true); }}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold transition active:scale-[0.98]"
              style={{
                background: 'transparent',
                color: 'var(--accent)',
                border: '2px solid var(--accent)',
              }}
            >
              Continuar guardando
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setCompletingChallengeId(null); setSheetOpen(true); }}
            className="mx-auto flex h-[54px] w-full max-w-sm items-center justify-center gap-2 rounded-full text-[15px] font-extrabold text-white transition active:scale-[0.98]"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 10px 30px var(--plus-shadow)',
            }}
          >
            <Plus size={18} strokeWidth={3} /> Registrar depósito
          </button>
        )}
      </section>

      {/* ── Sub-overlays ──────────────────────────────────────────────── */}
      {userId && (
        <ContributionSheet
          open={sheetOpen}
          missionId={mission.id}
          userId={userId}
          targetAmount={target}
          totalSaved={totalSaved}
          monthlyTarget={monthlyTarget}
          alreadySavedThisMonth={totalThisMonth}
          shouldGenerateChallenge={isPro && !challenge}
          initialAmount={
            completingChallengeId ? Number(challenge?.potentialSavings ?? 0) : 0
          }
          contextLabel={
            completingChallengeId ? 'Você completou o desafio e está guardando! 🎯' : undefined
          }
          onClose={() => {
            setSheetOpen(false);
            setCompletingChallengeId(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <HistoryModal
        open={historyOpen}
        groups={grouped}
        monthlyTarget={monthlyTarget}
        onClose={() => setHistoryOpen(false)}
      />

      {milestone && (
        <MilestoneModal
          open
          kind={milestone.kind}
          badgeKey={milestone.badgeKey}
          onClose={() => setMilestone(null)}
          onCreateNewMission={milestone.kind === 100 ? () => {
            setMilestone(null);
            handleStartNewMission();
          } : undefined}
        />
      )}

      <ConquistasModal
        open={conquistasModalOpen}
        unlockedKeys={badges}
        onClose={() => setConquistasModalOpen(false)}
        onSelectBadge={(b) => setActiveBadge(b)}
      />

      <HistoricoMissoesModal
        open={historicoMissoesOpen}
        entries={pastMissions}
        onClose={() => setHistoricoMissoesOpen(false)}
      />

      <BadgeDetailSheet
        badge={activeBadge}
        unlockedAt={activeBadge ? badgeUnlockedAt[activeBadge.key] : undefined}
        onClose={() => setActiveBadge(null)}
      />

      <SwapMissionConfirm
        open={swapConfirmOpen}
        loading={swapping}
        onCancel={() => setSwapConfirmOpen(false)}
        onConfirm={handleSwapMission}
      />
    </main>
  );
}

// ─── Card compacto de missão anterior ────────────────────────────────────
// Não-clicável (apenas leitura): nome + pill de status + valor + barra fina
// na cor do status (verde concluída / amarelo pausada).

function PastMissionCard({ entry }: { entry: PastMissionEntry }) {
  const { mission, totalSaved } = entry;
  const target = Number(mission.targetAmount);
  const pct = target > 0 ? Math.min(100, (totalSaved / target) * 100) : 0;
  const isCompleted = mission.status === 'completed';
  const barColor = isCompleted ? 'var(--green)' : 'var(--yellow)';

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--card-shadow)',
        borderRadius: 'var(--r)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="min-w-0 flex-1 truncate text-[14px] font-extrabold"
          style={{ color: 'var(--text)' }}
        >
          {mission.name}
        </p>
        <span
          className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold"
          style={{
            background: isCompleted ? 'var(--green-bg)' : 'var(--yellow-bg)',
            color: isCompleted ? 'var(--green-text)' : 'var(--yellow-text)',
          }}
        >
          {isCompleted ? 'Concluída ✓' : 'Pausada'}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] font-bold" style={{ color: 'var(--text-2)' }}>
        {formatCurrency(totalSaved)} de {formatCurrency(target)} · {Math.round(pct)}%
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
    </div>
  );
}

// ─── Modal de confirmação de troca de missão ────────────────────────────
// Padrão consistente com o ContributionSheet: overlay z-50, card centralizado,
// max-w-sm. Não fecha ao clicar fora porque a ação primária é destrutiva
// (pausar implica progresso “fora do dashboard” até retomar) e o usuário
// pode tocar o overlay sem querer no mobile.

function SwapMissionConfirm({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed top-1/2 left-1/2 z-[60] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 mx-4"
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h3 className="text-[17px] font-extrabold" style={{ color: 'var(--text)' }}>
          Tem certeza?
        </h3>
        <p className="mt-2 text-[14px] font-medium leading-snug" style={{ color: 'var(--text-2)' }}>
          Seu progresso será salvo, mas a missão ficará pausada.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex h-[48px] flex-1 items-center justify-center rounded-2xl text-[14px] font-extrabold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex h-[48px] flex-1 items-center justify-center rounded-2xl text-[14px] font-extrabold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: 'var(--accent)',
              borderRadius: 'var(--r-sm)',
              boxShadow: '0 6px 20px var(--accent-shadow)',
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Sim, trocar'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Modal de histórico completo ─────────────────────────────────────────

function HistoryModal({
  open,
  groups,
  monthlyTarget,
  onClose,
}: {
  open: boolean;
  groups: ReturnType<typeof groupByMonth>;
  monthlyTarget: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Mesmo padrão do ContributionSheet: overlay z-50 + card centralizado
          na viewport (top/left + translate). max-w-sm + mx-4 mantém respiro
          em telas estreitas. Sem isso, o modal estava abrindo deslocado por
          herdar o flex-end + max-width customizado. */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4 z-50"
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold" style={{ color: 'var(--text)' }}>
            Histórico completo
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'var(--bg)' }}
          >
            <X size={16} color="var(--text-2)" />
          </button>
        </div>

        <div className="mt-4">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-[13px] font-bold" style={{ color: 'var(--text-2)' }}>
              Nenhum depósito registrado ainda.
            </p>
          ) : (
            groups.map((g) => {
              const diff = g.total - monthlyTarget;
              return (
                <div key={g.month} className="mb-4 last:mb-0">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[13px] font-extrabold" style={{ color: 'var(--text)' }}>
                      {monthHeaderLabel(g.month)}
                    </p>
                    <span
                      className="text-[12px] font-extrabold"
                      style={{ color: diff >= 0 ? 'var(--green-text)' : 'var(--red)' }}
                    >
                      Total {formatCurrency(g.total)}
                    </span>
                  </div>
                  <div
                    className="overflow-hidden rounded-2xl"
                    style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)' }}
                  >
                    {g.items.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-4 py-2"
                        style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-2)' }}
                      >
                        <span className="text-[12px] font-bold" style={{ color: 'var(--text-2)' }}>
                          {new Date(c.registeredAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </span>
                        <span className="text-[13px] font-extrabold" style={{ color: 'var(--text)' }}>
                          {formatCurrency(Number(c.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

// ─── Atalho de acesso rápido (Conquistas / Histórico) ────────────────────

function QuickAccessButton({
  emoji,
  label,
  onClick,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border bg-white p-3 transition hover:border-[#5B5BD6] active:scale-[0.98]"
      style={{ borderColor: '#e5e7eb' }}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
        {label}
      </span>
    </button>
  );
}

// ─── Item compartilhado da grid de badges ───────────────────────────────
// Mesmo visual nas duas grids (horizontal scroll na seção + 3 cols no modal
// de Conquistas). Centraliza o styling dos estados travado/desbloqueado.

function BadgeGridItem({
  badge,
  unlocked,
  onClick,
}: {
  badge: BadgeDef;
  unlocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-[88px] flex-shrink-0 flex-col items-center rounded-2xl p-3 transition active:scale-95"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--card-shadow)',
        borderRadius: 'var(--r)',
      }}
    >
      <div
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{ background: unlocked ? 'var(--accent-bg)' : 'var(--border)' }}
      >
        <span className="text-xl leading-none" style={{ opacity: unlocked ? 1 : 0.4 }}>
          {badge.emoji}
        </span>
      </div>
      <p
        className="mt-2 line-clamp-2 text-center text-[10px] font-extrabold leading-tight"
        style={{ color: unlocked ? 'var(--text)' : 'var(--text-2)' }}
      >
        {badge.name}
      </p>
      {unlocked && (
        <span
          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full"
          style={{ background: 'var(--green)', color: 'white' }}
        >
          <Check size={10} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

// ─── Modal de Conquistas (grid 3 colunas) ────────────────────────────────
// Mesmo padrão centralizado do HistoryModal: overlay z-50 + card max-w-sm.
// Reusa BadgeGridItem — toque num desbloqueado fecha este modal e abre o
// BadgeDetailSheet (encadeado via onSelectBadge no parent).

function ConquistasModal({
  open,
  unlockedKeys,
  onClose,
  onSelectBadge,
}: {
  open: boolean;
  unlockedKeys: string[];
  onClose: () => void;
  onSelectBadge: (b: BadgeDef) => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed top-1/2 left-1/2 z-50 mx-4 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold" style={{ color: 'var(--text)' }}>
            Suas conquistas
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'var(--bg)' }}
          >
            <X size={16} color="var(--text-2)" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 justify-items-center gap-3">
          {BADGES.map((b) => (
            <BadgeGridItem
              key={b.key}
              badge={b}
              unlocked={unlockedKeys.includes(b.key)}
              onClick={() => {
                if (!unlockedKeys.includes(b.key)) return;
                onClose();
                onSelectBadge(b);
              }}
            />
          ))}
        </div>

        {/* Link pra página completa de conquistas. onClose() restaura o
            body overflow antes da navegação (a página é unmount após). */}
        <Link
          href="/missao/badges"
          onClick={onClose}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-xl border-2 text-[13px] font-extrabold transition active:scale-[0.98]"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          Ver conquistas completas →
        </Link>
      </div>
    </>
  );
}

// ─── Modal de Histórico de Missões ───────────────────────────────────────
// Lista as mesmas missões da seção inline. Empty state quando ainda não
// há missões fechadas/pausadas — esperado: o atalho fica visível mesmo
// vazio (UX consistente).

function HistoricoMissoesModal({
  open,
  entries,
  onClose,
}: {
  open: boolean;
  entries: PastMissionEntry[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed top-1/2 left-1/2 z-50 mx-4 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold" style={{ color: 'var(--text)' }}>
            Missões anteriores
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'var(--bg)' }}
          >
            <X size={16} color="var(--text-2)" />
          </button>
        </div>

        {entries.length === 0 ? (
          <p
            className="mt-6 py-8 text-center text-[13px] font-bold"
            style={{ color: 'var(--text-2)' }}
          >
            Nenhuma missão concluída ainda. Continue guardando!
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {entries.map((pm) => (
              <PastMissionCard key={pm.mission.id} entry={pm} />
            ))}
          </div>
        )}

        {/* Atalho pra aba Histórico da página de conquistas — query param
            `tab=historico` é lido lá via useSearchParams pra setar o estado
            inicial da aba. */}
        <Link
          href="/missao/badges?tab=historico"
          onClick={onClose}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-xl border-2 text-[13px] font-extrabold transition active:scale-[0.98]"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          Ver histórico completo →
        </Link>
      </div>
    </>
  );
}

