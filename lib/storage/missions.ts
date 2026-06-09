import { createClient } from '../supabase/client';
import { cachedFetch, TTL, withCacheInvalidation } from '../dataCache';

export interface SavingsMission {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  months: number;
  monthlyTarget: number;
  startDate: string;       // YYYY-MM-DD
  targetDate: string;      // YYYY-MM-DD
  remindersEnabled: boolean;
  aiChallengesEnabled: boolean;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
}

export interface MissionContribution {
  id: string;
  missionId: string;
  userId: string;
  month: string;           // YYYY-MM
  amount: number;
  registeredAt: string;
}

export interface MissionChallenge {
  id: string;
  missionId: string;
  userId: string;
  month: string;           // YYYY-MM
  challengeText: string;
  potentialSavings?: number;
  accepted: boolean;
  dismissed: boolean;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface MissionBadge {
  id: string;
  userId: string;
  missionId: string;
  badgeKey: string;
  unlockedAt: string;
}

export type NewMissionInput = Omit<SavingsMission, 'id' | 'userId' | 'createdAt' | 'status'> & {
  status?: SavingsMission['status'];
};

function toMission(row: Record<string, unknown>): SavingsMission {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    targetAmount: Number(row.target_amount),
    months: row.months as SavingsMission['months'],
    monthlyTarget: Number(row.monthly_target),
    startDate: row.start_date as string,
    targetDate: row.target_date as string,
    remindersEnabled: (row.reminders_enabled as boolean | null) ?? true,
    aiChallengesEnabled: (row.ai_challenges_enabled as boolean | null) ?? true,
    status: row.status as SavingsMission['status'],
    createdAt: row.created_at as string,
  };
}

function toContribution(row: Record<string, unknown>): MissionContribution {
  return {
    id: row.id as string,
    missionId: row.mission_id as string,
    userId: row.user_id as string,
    month: row.month as string,
    amount: Number(row.amount),
    registeredAt: row.registered_at as string,
  };
}

function toChallenge(row: Record<string, unknown>): MissionChallenge {
  return {
    id: row.id as string,
    missionId: row.mission_id as string,
    userId: row.user_id as string,
    month: row.month as string,
    challengeText: row.challenge_text as string,
    potentialSavings: row.potential_savings == null ? undefined : Number(row.potential_savings),
    accepted: (row.accepted as boolean | null) ?? false,
    dismissed: (row.dismissed as boolean | null) ?? false,
    completed: (row.completed as boolean | null) ?? false,
    completedAt: (row.completed_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function toBadge(row: Record<string, unknown>): MissionBadge {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    missionId: row.mission_id as string,
    badgeKey: row.badge_key as string,
    unlockedAt: row.unlocked_at as string,
  };
}

export async function getMission(userId: string): Promise<SavingsMission | null> {
  return cachedFetch(`savings_missions:${userId}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('savings_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return toMission(data);
  });
}

// Fetch direto por ID, usado pelo checkAndUnlockBadges que precisa do
// start_date/monthly_target da missão exata sendo aportada (pode não ser a
// "ativa" se a UI mudou no meio do fluxo). Cacheado pelo mesmo prefixo do
// getMission para invalidar junto em qualquer escrita de savings_missions.
export async function getMissionById(missionId: string): Promise<SavingsMission | null> {
  return cachedFetch(`savings_missions:byId:${missionId}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('savings_missions')
      .select('*')
      .eq('id', missionId)
      .maybeSingle();
    if (error || !data) return null;
    return toMission(data);
  });
}

// Lista de missões fechadas (concluídas) ou pausadas — usada pela aba
// Histórico em /missao/badges. Cacheada com prefixo `savings_missions:` para
// invalidar junto com getMission/getCompletedMissionsCount quando uma missão
// muda de status (completeMission / pauseMission).
export async function getCompletedMissions(userId: string): Promise<SavingsMission[]> {
  return cachedFetch(`savings_missions:history:${userId}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('savings_missions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['completed', 'paused'])
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(toMission);
  });
}

export async function createMission(userId: string, data: NewMissionInput): Promise<SavingsMission> {
  return withCacheInvalidation('savings_missions', async () => {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from('savings_missions')
      .insert({
        user_id: userId,
        name: data.name,
        target_amount: data.targetAmount,
        months: data.months,
        monthly_target: data.monthlyTarget,
        start_date: data.startDate,
        target_date: data.targetDate,
        reminders_enabled: data.remindersEnabled,
        ai_challenges_enabled: data.aiChallengesEnabled,
        status: data.status ?? 'active',
      })
      .select()
      .single();
    if (error) {
      console.error('createMission:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao criar missão');
    }
    return toMission(row);
  });
}

// Pausa a missão (status='paused'). Mantém o progresso (contribuições/badges
// continuam no banco), mas libera o slot — getMission filtra por 'active', então
// pausar permite o usuário criar uma nova missão sem perder o histórico.
export async function pauseMission(missionId: string): Promise<void> {
  return withCacheInvalidation('savings_missions', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { error } = await supabase
      .from('savings_missions')
      .update({ status: 'paused' })
      .eq('id', missionId)
      .eq('user_id', user.id);
    if (error) {
      console.error('pauseMission:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao pausar missão');
    }
  });
}

// Fecha a missão (status='completed'). Invalida o cache de savings_missions —
// inclui a contagem usada pelo badge `mestre_clt` em getCompletedMissionsCount.
export async function completeMission(missionId: string): Promise<void> {
  return withCacheInvalidation('savings_missions', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { error } = await supabase
      .from('savings_missions')
      .update({ status: 'completed' })
      .eq('id', missionId)
      .eq('user_id', user.id);
    if (error) {
      console.error('completeMission:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao concluir missão');
    }
  });
}

export async function getContributions(missionId: string): Promise<MissionContribution[]> {
  return cachedFetch(`mission_contributions:${missionId}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('mission_contributions')
      .select('*')
      .eq('mission_id', missionId)
      .order('registered_at', { ascending: false });
    if (error) return [];
    return (data ?? []).map(toContribution);
  });
}

export async function addContribution(
  missionId: string,
  userId: string,
  month: string,
  amount: number,
): Promise<MissionContribution> {
  return withCacheInvalidation('mission_contributions', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    // Defesa em profundidade: o aporte só pode ser registrado para o próprio
    // usuário autenticado, nunca para o userId arbitrário recebido por parâmetro.
    if (user.id !== userId) throw new Error('Usuário não autorizado');
    const { data, error } = await supabase
      .from('mission_contributions')
      .insert({
        mission_id: missionId,
        user_id: user.id,
        month,
        amount,
      })
      .select()
      .single();
    if (error) {
      console.error('addContribution:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao registrar aporte');
    }
    return toContribution(data);
  });
}

// Deriva da lista cacheada de contribuições — evita um round-trip extra
// e mantém ambos em sincronia automaticamente quando a cache é invalidada.
export async function getTotalSaved(missionId: string): Promise<number> {
  const contributions = await getContributions(missionId);
  return contributions.reduce((sum, c) => sum + Number(c.amount), 0);
}

// Soma de TODOS os aportes do usuário em qualquer missão (ativa, pausada ou
// concluída). Usado para os badges `poupador_iniciante/dedicado/elite`, que
// medem o esforço acumulado ao longo do tempo, não o progresso de uma missão.
export async function getTotalSavedByUser(userId: string): Promise<number> {
  return cachedFetch(`mission_contributions:total:${userId}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('mission_contributions')
      .select('amount')
      .eq('user_id', userId);
    if (error || !data) return 0;
    return data.reduce((s, r) => s + Number(r.amount), 0);
  });
}

export async function getChallenges(missionId: string, month: string): Promise<MissionChallenge[]> {
  return cachedFetch(`mission_challenges:${missionId}:${month}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('mission_challenges')
      .select('*')
      .eq('mission_id', missionId)
      .eq('month', month)
      .eq('dismissed', false)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []).map(toChallenge);
  });
}

export async function acceptChallenge(id: string): Promise<void> {
  return withCacheInvalidation('mission_challenges', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { error } = await supabase
      .from('mission_challenges')
      .update({ accepted: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      console.error('acceptChallenge:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao aceitar desafio');
    }
  });
}

export async function dismissChallenge(id: string): Promise<void> {
  return withCacheInvalidation('mission_challenges', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { error } = await supabase
      .from('mission_challenges')
      .update({ dismissed: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      console.error('dismissChallenge:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao descartar desafio');
    }
  });
}

export async function getBadges(userId: string, missionId: string): Promise<MissionBadge[]> {
  return cachedFetch(`mission_badges:${missionId}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('mission_badges')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_id', missionId)
      .order('unlocked_at', { ascending: true });
    if (error) return [];
    return (data ?? []).map(toBadge);
  });
}

// Todos os badges desbloqueados pelo usuário em QUALQUER missão (ativa,
// pausada ou concluída). Usado por /missao/badges, onde a página de
// conquistas acumula o histórico do usuário — o `getBadges` por missionId
// só serve pro dashboard, que reflete o progresso da missão ativa.
export async function getAllUserBadges(userId: string): Promise<string[]> {
  return cachedFetch(`mission_badges:user:${userId}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('mission_badges')
      .select('badge_key')
      .eq('user_id', userId);
    if (error || !data) return [];
    return Array.from(new Set(data.map((r) => r.badge_key as string)));
  });
}

export async function unlockBadge(
  userId: string,
  missionId: string,
  badgeKey: string,
): Promise<void> {
  return withCacheInvalidation('mission_badges', async () => {
    const supabase = createClient();
    // UNIQUE(user_id, mission_id, badge_key) garante idempotência: o upsert com
    // ignoreDuplicates vira no-op se o badge já foi conquistado.
    const { error } = await supabase
      .from('mission_badges')
      .upsert(
        { user_id: userId, mission_id: missionId, badge_key: badgeKey },
        { onConflict: 'user_id,mission_id,badge_key', ignoreDuplicates: true },
      );
    if (error) {
      console.error('unlockBadge:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao desbloquear badge');
    }
  });
}

// Quantas missões esse usuário já fechou? Usado para destravar o badge
// `mestre_clt` (2 metas completas). Cacheado pela mesma chave de missions
// para invalidar junto quando uma missão muda de status.
export async function getCompletedMissionsCount(userId: string): Promise<number> {
  return cachedFetch(`savings_missions:completed_count:${userId}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from('savings_missions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');
    return count ?? 0;
  });
}

// Conta meses consecutivos de aportes a partir do mais recente.
// Ex.: contribuições em ['2026-05','2026-04','2026-02'] → streak = 2 (maio + abril);
// fevereiro quebra a sequência. Múltiplos aportes no mesmo mês contam como um.
export function calcStreak(contributions: MissionContribution[]): number {
  if (contributions.length === 0) return 0;
  const months = Array.from(new Set(contributions.map((c) => c.month))).sort().reverse();
  let streak = 1;
  for (let i = 1; i < months.length; i++) {
    if (isPreviousMonth(months[i - 1], months[i])) streak++;
    else break;
  }
  return streak;
}

function isPreviousMonth(current: string, candidate: string): boolean {
  const [cy, cm] = current.split('-').map(Number);
  const [py, pm] = candidate.split('-').map(Number);
  if (cm === 1) return py === cy - 1 && pm === 12;
  return py === cy && pm === cm - 1;
}

// Total de meses cobertos entre `startDate` (YYYY-MM-DD) e o mês corrente
// (inclusive em ambos). Ex.: start='2026-01-15', hoje em '2026-05-*' → 5.
function monthsSinceStartInclusive(startDate: string, today: Date): number {
  const [sy, sm] = startDate.split('-').map(Number);
  const cy = today.getFullYear();
  const cm = today.getMonth() + 1;
  return Math.max(1, (cy - sy) * 12 + (cm - sm) + 1);
}

// Diferença em dias entre a data de início da missão e a primeira contribuição
// (ambas convertidas para BRT pra não atravessar fronteira de dia por UTC).
function daysBetweenStartAndFirst(startDate: string, firstRegisteredAt: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const firstMs = new Date(firstRegisteredAt).getTime();
  return (firstMs - startMs) / 86_400_000;
}

// Avalia todos os badges automáticos (silenciosos + novos da expansão) e
// desbloqueia os que o usuário merece e ainda não tem. Idempotente: roda
// múltiplas vezes sem custo (UNIQUE constraint no banco) e devolve a lista
// de chaves recém-criadas para callers que queiram reagir (toast, animação).
//
// Os badges de marco visual (meio_caminho, meta_batida, primeiro_quarto e
// mestre_clt) seguem sendo tratados no dashboard pelo triggerMilestoneIfAny,
// porque disparam MilestoneModal — não devem ser unlockeados silenciosamente
// aqui pra não engolir a celebração.
export async function checkAndUnlockBadges(
  userId: string,
  missionId: string,
): Promise<string[]> {
  const [mission, existing, contribs, totalAcrossUser, completedCount] = await Promise.all([
    getMissionById(missionId),
    getAllUserBadges(userId),
    getContributions(missionId),
    getTotalSavedByUser(userId),
    getCompletedMissionsCount(userId),
  ]);
  if (!mission) return [];

  const have = new Set(existing);
  const toUnlock: string[] = [];

  const push = (key: string) => {
    if (!have.has(key)) toUnlock.push(key);
  };

  // ─── Silenciosos legados (também tratados no dashboard, idempotência ok) ─
  if (contribs.length >= 1) push('primeiro_passo');

  // ─── Streak ────────────────────────────────────────────────────────────
  const streak = calcStreak(contribs);
  if (streak >= 3) {
    push('consistente');
    push('em_chama');
  }
  if (streak >= 6) {
    push('expert');
    push('inabalavel');
  }
  if (streak >= 12) push('lendario');

  // ─── Valor acumulado cross-missão ──────────────────────────────────────
  if (totalAcrossUser >= 1_000) push('poupador_iniciante');
  if (totalAcrossUser >= 5_000) push('poupador_dedicado');
  if (totalAcrossUser >= 50_000) push('poupador_elite');

  // ─── Missões concluídas (somam-se ao mestre_clt do dashboard) ─────────
  if (completedCount >= 3) push('recorrente');
  if (completedCount >= 5) push('serial_saver');

  // ─── Comportamento ─────────────────────────────────────────────────────
  // largada_rapida: 1º depósito dentro de 7 dias após start_date.
  if (contribs.length > 0 && !have.has('largada_rapida')) {
    // getContributions vem ordenado desc por registered_at; pegamos o último
    // (mais antigo) como primeiro depósito.
    const first = contribs[contribs.length - 1];
    if (daysBetweenStartAndFirst(mission.startDate, first.registeredAt) <= 7) {
      push('largada_rapida');
    }
  }

  // pontual: aporte em todos os meses desde o início. Exige ≥2 meses de
  // tenure pro badge não disparar trivialmente no 1º depósito.
  if (!have.has('pontual')) {
    const monthsCovered = new Set(contribs.map((c) => c.month)).size;
    const monthsSinceStart = monthsSinceStartInclusive(mission.startDate, new Date());
    if (monthsSinceStart >= 2 && monthsCovered >= monthsSinceStart) push('pontual');
  }

  // dobrou_meta: algum mês com total ≥ 2× monthlyTarget.
  if (mission.monthlyTarget > 0 && !have.has('dobrou_meta')) {
    const byMonth = new Map<string, number>();
    for (const c of contribs) {
      byMonth.set(c.month, (byMonth.get(c.month) ?? 0) + Number(c.amount));
    }
    for (const total of byMonth.values()) {
      if (total >= 2 * mission.monthlyTarget) {
        push('dobrou_meta');
        break;
      }
    }
  }

  if (toUnlock.length === 0) return [];
  // Promise.all + ignoreDuplicates no upsert: idempotente mesmo em race.
  await Promise.all(toUnlock.map((k) => unlockBadge(userId, missionId, k)));
  return toUnlock;
}
