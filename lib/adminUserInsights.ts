import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll } from './adminFetchAll';
import { loadUserPlatforms, EMPTY_PLATFORM, type Platform } from './adminPlatform';
import { isRealUser } from './cohort';
import { ONBOARDING_STEPS, stepLabel } from './onboarding/steps';

// Raio-X de UM usuário para a página /admin/usuario?id=…
//
// Junta tudo o que a conta deixou no banco (lançamentos, acessos, metas,
// missão, gamificação, funil, e-mails e pushes recebidos) e devolve já
// agregado, para o painel entender COMO a pessoa usa o app, não só SE usa.
//
// Três regras que valem para todo o arquivo:
//   · "Dia" é o calendário de Brasília (UTC-3 fixo), igual ao resto do painel.
//     `user_activity.active_date` já vem no dia local; `created_at` é UTC.
//   · Tempo se compara por instante (getTime), nunca por string — o Postgres
//     devolve `+00:00` e o JS gera `Z`, e texto ordena os dois errado.
//   · A DESCRIÇÃO dos lançamentos (texto livre, pode ter nome, lugar, pessoa)
//     não sai daqui. Para entender comportamento basta categoria, valor e hora.

const DAY_MS = 24 * 60 * 60 * 1000;
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const CALENDAR_DAYS = 84; // 12 semanas no mapa de calor
const PAID_CYCLES = new Set(['monthly', 'annual']);

// Ordem do funil (fonte única: lib/onboarding/steps) para achar o passo mais adiantado.
const STEP_LIST = ONBOARDING_STEPS.map(s => s.label);
const STEP_ORDER = new Map(ONBOARDING_STEPS.map((s, i) => [s.key, i]));

/** AAAA-MM-DD no fuso de Brasília. */
function dayKey(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d).getTime() : d.getTime();
  return new Date(t - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Dias entre dois AAAA-MM-DD (a - b). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DAY_MS);
}

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const EMAIL_LABELS: Record<string, string> = {
  d0_welcome: 'E-mail de boas-vindas (D+0)',
  d3_engage: 'E-mail de engajamento (D+3)',
  d14_value: 'E-mail de valor (D+14)',
  d21_convert: 'E-mail de conversão (D+21)',
};

const PUSH_LABELS: Record<string, string> = {
  due_tomorrow: 'Push: conta vence amanhã',
  budget_exceeded: 'Push: orçamento estourado',
  weekly_summary: 'Push: resumo semanal',
};

const COIN_LABELS: Record<string, string> = {
  mission_contribution: 'Aporte na missão',
  goal_milestone_reward: 'Marco de meta',
  expense_logged: 'Lançamento registrado',
  app_open: 'Abriu o app',
  milestone_reward: 'Marco de sequência',
  recurring_paid: 'Conta fixa paga',
  freeze_purchase: 'Comprou congelamento',
  ai_challenge: 'Desafio da IA',
};

export type Engagement =
  | 'unconfirmed'   // não confirmou o e-mail
  | 'never_launched' // confirmou mas nunca registrou nada
  | 'active'        // visto nos últimos 3 dias
  | 'cooling'       // 4 a 13 dias sem aparecer
  | 'lost';         // 14+ dias sem aparecer

export type TimelineKind =
  | 'account' | 'onboarding' | 'launch' | 'goal' | 'mission' | 'subscription'
  | 'feedback' | 'email' | 'push' | 'reward' | 'setup';

export interface TimelineItem {
  at: string;
  kind: TimelineKind;
  title: string;
  detail?: string | null;
}

export interface UserInsights {
  account: {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
    is_blocked: boolean;
    /** Conta do tráfego (true) ou pré-lançamento/teste (false). Ver lib/cohort. */
    real_cohort: boolean;
    onboarding_completed: boolean;
    marketing_consent: boolean | null;
    whatsapp_verified: boolean;
    signup_platform: Platform | null;
    app_ios: boolean;
    app_android: boolean;
    push: { ios: boolean; android: boolean; web: boolean; first_at: string | null };
  };
  /** Respostas do quiz pré-cadastro (app 1.4+), gravadas no user_metadata. */
  quiz: {
    goalName: string | null;
    targetAmount: number | null;
    monthlyTarget: number | null;
    months: number | null;
    monthlyIncome: number | null;
    incomeSkipped: boolean;
    savingsPercent: number | null;
    painPoint: string | null;
    committedAt: string | null;
  } | null;
  subscription: {
    plan: string;
    status: string | null;
    billing_cycle: string | null;
    store: string | null;
    current_period_end: string | null;
    created_at: string | null;
    paying: boolean;
    /** Dias entre criar a conta e assinar (só pagante). */
    days_to_pay: number | null;
  };
  engagement: {
    status: Engagement;
    last_seen: string | null;
    days_since_seen: number | null;
    active_days: number;
    active_last_7: number;
    active_last_30: number;
    first_active: string | null;
    current_streak: number;
    longest_streak: number;
    /** null = conta nova demais para medir aquele dia. */
    d1: boolean | null;
    d7: boolean | null;
    d30: boolean | null;
  };
  launches: {
    total: number;
    /** Digitados pela pessoa (sem os gerados por conta fixa/salário). */
    manual: number;
    automatic: number;
    expenses: number;
    incomes: number;
    credit: number;
    expense_sum: number;
    income_sum: number;
    first_at: string | null;
    last_at: string | null;
    hours_to_first: number | null;
    distinct_days: number;
    avg_per_launch_day: number;
    /** 24 posições, hora de Brasília em que a pessoa DIGITOU. */
    by_hour: number[];
    /** 7 posições, domingo = 0. */
    by_weekday: number[];
    /** % dos manuais registrados no mesmo dia do gasto. */
    same_day_pct: number | null;
    /** Mediana de dias entre o gasto acontecer e ser registrado. */
    median_lag_days: number | null;
    top_categories: { category: string; count: number; sum: number }[];
    recent: {
      created_at: string;
      date: string;
      category: string;
      type: string;
      amount: number;
      is_credit: boolean;
      automatic: boolean;
    }[];
  };
  /** Últimas 12 semanas, um item por dia (mais antigo primeiro). */
  calendar: { day: string; active: boolean; frozen: boolean; launches: number }[];
  setup: {
    recurring_active: number;
    recurring_income: number;
    cards: number;
    budgets: number;
    custom_categories: number;
    monthly_plans: number;
    assets: number;
    liabilities: number;
    gastobot_uses: number;
  };
  goals: {
    name: string;
    emoji: string | null;
    target: number;
    current: number;
    status: string | null;
    created_at: string;
  }[];
  goal_contributions: number;
  mission: {
    name: string;
    target: number;
    monthly_target: number | null;
    months: number | null;
    status: string | null;
    created_at: string;
    contributions: number;
    contributed: number;
    challenges_accepted: number;
    challenges_completed: number;
  } | null;
  gamification: {
    coins_balance: number;
    coins_earned: number;
    coins_by_type: { type: string; label: string; count: number; amount: number }[];
    badges: { key: string; at: string }[];
    weekly_challenges_completed: number;
    weekly_challenges_total: number;
    streak_milestones: number[];
  };
  onboarding: {
    /** Passo mais adiantado visto (rótulo). */
    furthest: string | null;
    events: { at: string; step: string; label: string; action: string; platform: string | null }[];
  };
  communication: {
    emails: { type: string; label: string; at: string }[];
    pushes_by_type: { type: string; label: string; count: number; last_at: string }[];
    push_total: number;
  };
  feedback: { category: string; message: string; page: string | null; created_at: string }[];
  timeline: TimelineItem[];
}

type ExpenseRow = {
  amount: number; category: string; date: string; created_at: string;
  type: string; recurring_expense_id: string | null; is_credit: boolean | null;
};

type EventRow = {
  id: number; anon_id: string; user_id: string | null; step: string;
  action: string; platform: string | null; created_at: string;
};

export async function loadUserInsights(
  admin: SupabaseClient,
  id: string,
): Promise<UserInsights | null> {
  const { data: { user } } = await admin.auth.admin.getUserById(id);
  if (!user) return null;

  const byUser = <T>(table: string, columns: string) =>
    admin.from(table).select(columns).eq('user_id', id).then(r => (r.data ?? []) as T[]);

  const [
    expenses, activity, profileRes, subRes, block,
    tokens, webPush, recurring, cards, budgets, customCats, plans, assets, liabilities,
    gastobot, goals, goalContribs, missions, missionContribs, challenges,
    coins, coinTx, badges, weekly, streakMilestones,
    emails, pushLog, feedback, ownEvents, platforms,
  ] = await Promise.all([
    fetchAll<ExpenseRow>((from, to) => admin.from('expenses')
      .select('amount, category, date, created_at, type, recurring_expense_id, is_credit')
      .eq('user_id', id).order('created_at', { ascending: true }).order('id').range(from, to)),
    fetchAll<{ active_date: string; frozen: boolean | null }>((from, to) => admin.from('user_activity')
      .select('active_date, frozen').eq('user_id', id).order('active_date').range(from, to)),
    admin.from('profiles').select('name, marketing_consent, whatsapp_verified').eq('id', id).maybeSingle(),
    admin.from('subscriptions').select('plan, status, billing_cycle, store, current_period_end, created_at, updated_at')
      .eq('user_id', id).maybeSingle(),
    admin.from('user_blocks').select('id').eq('user_id', id).maybeSingle(),
    byUser<{ platform: string; created_at: string }>('device_tokens', 'platform, created_at'),
    byUser<{ created_at: string }>('push_subscriptions', 'created_at'),
    byUser<{ type: string | null; active: boolean | null; created_at: string; description: string }>(
      'recurring_expenses', 'type, active, created_at, description'),
    byUser<{ created_at: string }>('credit_cards', 'created_at'),
    byUser<{ id: string }>('budgets', 'id'),
    byUser<{ id: string }>('custom_categories', 'id'),
    byUser<{ id: string }>('monthly_plans', 'id'),
    byUser<{ id: string }>('assets', 'id'),
    byUser<{ id: string }>('liabilities', 'id'),
    byUser<{ count: number }>('gastobot_usage', 'count'),
    byUser<{ name: string; emoji: string | null; target_amount: number; current_amount: number; status: string | null; created_at: string }>(
      'goals', 'name, emoji, target_amount, current_amount, status, created_at'),
    byUser<{ id: string }>('goal_contributions', 'id'),
    byUser<{ id: string; name: string; target_amount: number; monthly_target: number | null; months: number | null; status: string | null; created_at: string }>(
      'savings_missions', 'id, name, target_amount, monthly_target, months, status, created_at'),
    byUser<{ amount: number; registered_at: string }>('mission_contributions', 'amount, registered_at'),
    byUser<{ accepted: boolean | null; completed: boolean | null }>('mission_challenges', 'accepted, completed'),
    admin.from('user_coins').select('balance, total_earned').eq('user_id', id).maybeSingle(),
    byUser<{ type: string; amount: number }>('coin_transactions', 'type, amount'),
    byUser<{ badge_key: string; unlocked_at: string }>('mission_badges', 'badge_key, unlocked_at'),
    byUser<{ completed: boolean | null; completed_at: string | null }>('weekly_challenges', 'completed, completed_at'),
    byUser<{ milestone_days: number; unlocked_at: string }>('streak_milestones', 'milestone_days, unlocked_at'),
    byUser<{ email_type: string; sent_at: string }>('email_funnel_log', 'email_type, sent_at'),
    byUser<{ type: string; sent_at: string }>('push_notification_log', 'type, sent_at'),
    byUser<{ category: string; message: string; page: string | null; created_at: string }>(
      'feedback', 'category, message, page, created_at'),
    byUser<EventRow>('onboarding_events', 'id, anon_id, user_id, step, action, platform, created_at'),
    loadUserPlatforms(admin),
  ]);

  // Eventos de ANTES da conta existir têm user_id null e só se ligam a ela
  // pelo anon_id do aparelho (mesma costura de lib/adminPlatform).
  const anonIds = [...new Set(ownEvents.map(e => e.anon_id))];
  const preEvents = anonIds.length
    ? ((await admin.from('onboarding_events')
        .select('id, anon_id, user_id, step, action, platform, created_at')
        .in('anon_id', anonIds).is('user_id', null)).data ?? []) as EventRow[]
    : [];
  const events = [...ownEvents, ...preEvents]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id);

  const now = new Date();
  const today = dayKey(now);
  const createdDay = dayKey(user.created_at);
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const profile = profileRes.data as { name: string | null; marketing_consent: boolean | null; whatsapp_verified: boolean | null } | null;
  const plat = platforms.get(id) ?? EMPTY_PLATFORM;

  // ── Lançamentos ────────────────────────────────────────────────
  const byHour = Array(24).fill(0) as number[];
  const byWeekday = Array(7).fill(0) as number[];
  const launchesPerDay = new Map<string, number>();
  const lags: number[] = [];
  const cats = new Map<string, { count: number; sum: number }>();
  let manual = 0, incomes = 0, credit = 0, expenseSum = 0, incomeSum = 0;

  for (const e of expenses) {
    const automatic = !!e.recurring_expense_id;
    const amount = Number(e.amount) || 0;
    if (e.type === 'income') { incomes++; incomeSum += amount; }
    else {
      expenseSum += amount;
      const c = cats.get(e.category) ?? { count: 0, sum: 0 };
      c.count++; c.sum += amount;
      cats.set(e.category, c);
    }
    if (e.is_credit) credit++;

    const localDay = dayKey(e.created_at);
    launchesPerDay.set(localDay, (launchesPerDay.get(localDay) ?? 0) + 1);

    // Hora/dia da semana e atraso só dos DIGITADOS: o lançamento automático
    // nasce na hora em que a pessoa abre o app, não quando ela decide registrar.
    if (automatic || e.category === 'Saldo inicial') continue;
    manual++;
    const local = new Date(new Date(e.created_at).getTime() - BRT_OFFSET_MS);
    byHour[local.getUTCHours()]++;
    byWeekday[local.getUTCDay()]++;
    if (e.date) lags.push(dayDiff(localDay, e.date.slice(0, 10)));
  }
  const pastLags = lags.filter(l => l >= 0); // data futura = agendado, não atraso
  const firstLaunch = expenses[0]?.created_at ?? null;
  const lastLaunch = expenses.length ? expenses[expenses.length - 1].created_at : null;

  // ── Acessos ────────────────────────────────────────────────────
  // Dia ativo = acesso gravado em user_activity OU dia com lançamento. O
  // registro de acesso falha às vezes (visto em produção: dia com lançamento e
  // sem linha em user_activity), e ninguém lança sem abrir o app.
  const activeSet = new Set([...activity.map(a => a.active_date), ...launchesPerDay.keys()]);
  const frozenSet = new Set(activity.filter(a => a.frozen).map(a => a.active_date));
  const activeSorted = [...activeSet].sort();

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of activeSorted) {
    run = prev && dayDiff(d, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  // Sequência atual: conta para trás a partir de hoje (ou de ontem, se hoje
  // ainda não abriu — a sequência só quebra quando o dia termina).
  let current = 0;
  let cursor = activeSet.has(today) ? today : addDays(today, -1);
  while (activeSet.has(cursor)) { current++; cursor = addDays(cursor, -1); }

  const retention = (n: number): boolean | null => {
    if (dayDiff(today, createdDay) < n) return null;
    return activeSet.has(addDays(createdDay, n));
  };

  // ── Engajamento ────────────────────────────────────────────────
  const seenCandidates = [
    activeSorted.length ? Date.parse(`${activeSorted[activeSorted.length - 1]}T12:00:00-03:00`) : 0,
    lastLaunch ? new Date(lastLaunch).getTime() : 0,
    user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0,
  ];
  const lastSeenTs = Math.max(...seenCandidates);
  const lastSeen = lastSeenTs > 0 ? dayKey(new Date(lastSeenTs)) : null;
  const daysSinceSeen = lastSeen ? Math.max(0, dayDiff(today, lastSeen)) : null;

  let status: Engagement;
  if (!user.email_confirmed_at) status = 'unconfirmed';
  else if (expenses.length === 0) status = 'never_launched';
  else if ((daysSinceSeen ?? 99) <= 3) status = 'active';
  else if ((daysSinceSeen ?? 99) <= 13) status = 'cooling';
  else status = 'lost';

  // ── Assinatura ─────────────────────────────────────────────────
  const sub = subRes.data as {
    plan: string; status: string | null; billing_cycle: string | null; store: string | null;
    current_period_end: string | null; created_at: string | null; updated_at: string | null;
  } | null;
  const paying = !!sub && sub.plan === 'pro' && PAID_CYCLES.has(sub.billing_cycle ?? '');

  // ── Missão ─────────────────────────────────────────────────────
  const mission = missions.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  // ── Quiz pré-cadastro ──────────────────────────────────────────
  const q = meta.presignup_mission as Record<string, unknown> | undefined;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

  // ── Comunicação ────────────────────────────────────────────────
  const pushGroups = new Map<string, { count: number; last: number }>();
  for (const p of pushLog) {
    const type = p.type.split(':')[0];
    const g = pushGroups.get(type) ?? { count: 0, last: 0 };
    g.count++;
    g.last = Math.max(g.last, new Date(p.sent_at).getTime());
    pushGroups.set(type, g);
  }

  const coinGroups = new Map<string, { count: number; amount: number }>();
  for (const t of coinTx) {
    const g = coinGroups.get(t.type) ?? { count: 0, amount: 0 };
    g.count++; g.amount += Number(t.amount) || 0;
    coinGroups.set(t.type, g);
  }

  // ── Linha do tempo ─────────────────────────────────────────────
  const timeline: TimelineItem[] = [];
  const push = (at: string | null | undefined, kind: TimelineKind, title: string, detail?: string | null) => {
    if (at) timeline.push({ at, kind, title, detail });
  };
  push(user.created_at, 'account', 'Criou a conta', plat.signup ? `pelo ${plat.signup === 'web' ? 'site' : `app ${plat.signup === 'ios' ? 'iOS' : 'Android'}`}` : null);
  push(user.email_confirmed_at, 'account', 'Confirmou o e-mail');
  const done = events.find(e => e.step === 'onb_done');
  push(done?.created_at, 'onboarding', 'Terminou o onboarding e entrou no app');
  const skippedAll = events.find(e => e.step === 'onb_welcome' && e.action === 'skip');
  push(skippedAll?.created_at, 'onboarding', 'Pulou o onboarding inteiro');
  for (const t of tokens) push(t.created_at, 'setup', `Ativou push no ${t.platform === 'ios' ? 'iOS' : 'Android'}`);
  for (const w of webPush) push(w.created_at, 'setup', 'Ativou push no navegador');
  for (const r of recurring) push(r.created_at, 'setup', r.type === 'income' ? 'Cadastrou uma renda fixa' : 'Cadastrou uma conta fixa');
  for (const c of cards) push(c.created_at, 'setup', 'Cadastrou um cartão');
  for (const g of goals) push(g.created_at, 'goal', 'Criou uma meta', `${g.emoji ?? ''} ${g.name}`.trim());
  if (mission) push(mission.created_at, 'mission', 'Começou a missão de poupança', mission.name);
  for (const c of missionContribs) push(c.registered_at, 'mission', 'Guardou dinheiro na missão', `R$ ${Number(c.amount).toFixed(2)}`);
  for (const b of badges) push(b.unlocked_at, 'reward', 'Desbloqueou uma conquista', b.badge_key);
  for (const s of streakMilestones) push(s.unlocked_at, 'reward', `Chegou a ${s.milestone_days} dias de sequência`);
  for (const f of feedback) push(f.created_at, 'feedback', 'Mandou feedback', f.message.slice(0, 140));
  for (const e of emails) push(e.sent_at, 'email', EMAIL_LABELS[e.email_type] ?? `E-mail ${e.email_type}`);
  for (const p of pushLog) push(p.sent_at, 'push', PUSH_LABELS[p.type.split(':')[0]] ?? `Push ${p.type}`);
  if (sub?.plan === 'pro' && sub.created_at) {
    push(sub.created_at, 'subscription', paying ? 'Assinou o Pro' : 'Recebeu Pro de cortesia', sub.billing_cycle);
  }
  if (sub?.status === 'cancelled') push(sub.updated_at, 'subscription', 'Cancelou o Pro');
  // Lançamentos agrupados por dia: um item por dia com a hora do último.
  const launchDays = new Map<string, { last: string; count: number; manual: number }>();
  for (const e of expenses) {
    const d = dayKey(e.created_at);
    const g = launchDays.get(d) ?? { last: e.created_at, count: 0, manual: 0 };
    g.count++;
    if (!e.recurring_expense_id) g.manual++;
    if (new Date(e.created_at).getTime() > new Date(g.last).getTime()) g.last = e.created_at;
    launchDays.set(d, g);
  }
  for (const g of launchDays.values()) {
    const auto = g.count - g.manual;
    push(g.last, 'launch',
      g.manual > 0 ? `Registrou ${g.manual} lançamento${g.manual === 1 ? '' : 's'}` : 'Lançamentos automáticos',
      auto > 0 ? `+ ${auto} automático${auto === 1 ? '' : 's'} (conta fixa/renda)` : null);
  }
  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // ── Calendário ─────────────────────────────────────────────────
  const calendar: UserInsights['calendar'] = [];
  for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    calendar.push({
      day,
      active: activeSet.has(day),
      frozen: frozenSet.has(day),
      launches: launchesPerDay.get(day) ?? 0,
    });
  }

  const furthestIdx = events.reduce((acc, e) => Math.max(acc, STEP_ORDER.get(e.step) ?? -1), -1);

  return {
    account: {
      id: user.id,
      email: user.email ?? '',
      name: profile?.name ?? str(meta.full_name) ?? str(q?.userFirstName),
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      is_blocked: !!block.data,
      real_cohort: isRealUser(user.created_at),
      onboarding_completed: meta.onboarding_completed === true,
      marketing_consent: profile?.marketing_consent ?? null,
      whatsapp_verified: !!profile?.whatsapp_verified,
      signup_platform: plat.signup,
      app_ios: plat.ios,
      app_android: plat.android,
      push: {
        ios: tokens.some(t => t.platform === 'ios'),
        android: tokens.some(t => t.platform === 'android'),
        web: webPush.length > 0,
        first_at: [...tokens, ...webPush].map(t => t.created_at)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null,
      },
    },
    quiz: q ? {
      goalName: str(q.name),
      targetAmount: num(q.targetAmount),
      monthlyTarget: num(q.monthlyTarget),
      months: num(q.months),
      monthlyIncome: num(q.monthlyIncome),
      incomeSkipped: q.incomeSkipped === true,
      savingsPercent: num(q.savingsPercent),
      painPoint: str(q.painPoint),
      committedAt: str(q.committedAt),
    } : null,
    subscription: {
      plan: sub?.plan ?? 'free',
      status: sub?.status ?? null,
      billing_cycle: sub?.billing_cycle ?? null,
      store: sub?.store ?? null,
      current_period_end: sub?.current_period_end ?? null,
      created_at: sub?.created_at ?? null,
      paying,
      days_to_pay: paying && sub?.created_at ? Math.max(0, dayDiff(dayKey(sub.created_at), createdDay)) : null,
    },
    engagement: {
      status,
      last_seen: lastSeen,
      days_since_seen: daysSinceSeen,
      active_days: activeSet.size,
      active_last_7: activeSorted.filter(d => dayDiff(today, d) < 7).length,
      active_last_30: activeSorted.filter(d => dayDiff(today, d) < 30).length,
      first_active: activeSorted[0] ?? null,
      current_streak: current,
      longest_streak: longest,
      d1: retention(1),
      d7: retention(7),
      d30: retention(30),
    },
    launches: {
      total: expenses.length,
      manual,
      automatic: expenses.filter(e => e.recurring_expense_id).length,
      expenses: expenses.length - incomes,
      incomes,
      credit,
      expense_sum: Math.round(expenseSum * 100) / 100,
      income_sum: Math.round(incomeSum * 100) / 100,
      first_at: firstLaunch,
      last_at: lastLaunch,
      hours_to_first: firstLaunch
        ? Math.max(0, Math.round((new Date(firstLaunch).getTime() - new Date(user.created_at).getTime()) / 36e5))
        : null,
      distinct_days: launchesPerDay.size,
      avg_per_launch_day: launchesPerDay.size ? Math.round((expenses.length / launchesPerDay.size) * 10) / 10 : 0,
      by_hour: byHour,
      by_weekday: byWeekday,
      same_day_pct: pastLags.length ? Math.round((pastLags.filter(l => l === 0).length / pastLags.length) * 100) : null,
      median_lag_days: median(pastLags),
      top_categories: [...cats.entries()]
        .map(([category, v]) => ({ category, count: v.count, sum: Math.round(v.sum * 100) / 100 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      recent: expenses.slice(-15).reverse().map(e => ({
        created_at: e.created_at,
        date: e.date,
        category: e.category,
        type: e.type,
        amount: Number(e.amount) || 0,
        is_credit: !!e.is_credit,
        automatic: !!e.recurring_expense_id,
      })),
    },
    calendar,
    setup: {
      recurring_active: recurring.filter(r => r.active !== false).length,
      recurring_income: recurring.filter(r => r.type === 'income').length,
      cards: cards.length,
      budgets: budgets.length,
      custom_categories: customCats.length,
      monthly_plans: plans.length,
      assets: assets.length,
      liabilities: liabilities.length,
      gastobot_uses: gastobot.reduce((s, g) => s + (Number(g.count) || 0), 0),
    },
    goals: goals.map(g => ({
      name: g.name,
      emoji: g.emoji,
      target: Number(g.target_amount) || 0,
      current: Number(g.current_amount) || 0,
      status: g.status,
      created_at: g.created_at,
    })),
    goal_contributions: goalContribs.length,
    mission: mission ? {
      name: mission.name,
      target: Number(mission.target_amount) || 0,
      monthly_target: mission.monthly_target,
      months: mission.months,
      status: mission.status,
      created_at: mission.created_at,
      contributions: missionContribs.length,
      contributed: Math.round(missionContribs.reduce((s, c) => s + (Number(c.amount) || 0), 0) * 100) / 100,
      challenges_accepted: challenges.filter(c => c.accepted).length,
      challenges_completed: challenges.filter(c => c.completed).length,
    } : null,
    gamification: {
      coins_balance: Number((coins.data as { balance?: number } | null)?.balance) || 0,
      coins_earned: Number((coins.data as { total_earned?: number } | null)?.total_earned) || 0,
      coins_by_type: [...coinGroups.entries()]
        .map(([type, v]) => ({ type, label: COIN_LABELS[type] ?? type, count: v.count, amount: v.amount }))
        .sort((a, b) => b.count - a.count),
      badges: badges.map(b => ({ key: b.badge_key, at: b.unlocked_at })),
      weekly_challenges_completed: weekly.filter(w => w.completed).length,
      weekly_challenges_total: weekly.length,
      streak_milestones: streakMilestones.map(s => s.milestone_days).sort((a, b) => a - b),
    },
    onboarding: {
      furthest: furthestIdx >= 0 ? STEP_LIST[furthestIdx] : null,
      events: events.map(e => ({
        at: e.created_at,
        step: e.step,
        label: stepLabel(e.step),
        action: e.action,
        platform: e.platform,
      })),
    },
    communication: {
      emails: emails
        .map(e => ({ type: e.email_type, label: EMAIL_LABELS[e.email_type] ?? e.email_type, at: e.sent_at }))
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
      pushes_by_type: [...pushGroups.entries()]
        .map(([type, v]) => ({ type, label: PUSH_LABELS[type] ?? type, count: v.count, last_at: new Date(v.last).toISOString() }))
        .sort((a, b) => b.count - a.count),
      push_total: pushLog.length,
    },
    feedback: feedback.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    timeline,
  };
}
