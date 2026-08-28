import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps';
import { COHORT_START_DAY, cohortStart, parseCohort } from '@/lib/cohort';

// Painel do funil de onboarding. Devolve QUATRO blocos independentes:
//
//  1. eventFunnel   — passo a passo real, vindo de onboarding_events. Só tem
//                     dado a partir do dia em que a instrumentação subiu.
//  2. derivedFunnel — funil INFERIDO dos dados que o usuário deixou no banco
//                     (tem salário? tem cartão? tem meta?). Funciona
//                     retroativamente, inclusive para quem entrou antes da
//                     instrumentação. É aproximação: quem cadastrou o cartão
//                     depois, fora do onboarding, conta igual.
//  3. conversion    — cadastro → Pro PAGANTE. Cortesia (manual/beta/cupom)
//                     entra em número separado e NUNCA na taxa.
//  4. retention     — volta ao app depois do cadastro, via user_activity.
//
// Tudo respeita ?cohort=real (padrão, só quem entrou a partir do marco) ou
// ?cohort=all (inclui o legado pré-lançamento).

const DAY_MS = 24 * 60 * 60 * 1000;

/** AAAA-MM-DD no fuso de Brasília — mesmo critério de "dia" do resto do painel. */
function dayKey(d: Date): string {
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Dias inteiros entre duas datas (a - b). */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

function rate(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const admin = createAdminClient();
  const cohort = parseCohort(req.nextUrl.searchParams.get('cohort'));
  const start = cohortStart();
  const now = new Date();

  // ─── POPULAÇÃO ────────────────────────────────────────────────
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const legacyCount = allUsers.filter(u => new Date(u.created_at) < start).length;
  const population = cohort === 'all'
    ? allUsers
    : allUsers.filter(u => new Date(u.created_at) >= start);
  const ids = new Set(population.map(u => u.id));
  const total = population.length;
  const emailOf = new Map(population.map(u => [u.id, u.email ?? '—']));
  const createdAtOf = new Map(population.map(u => [u.id, new Date(u.created_at)]));

  const confirmed = population.filter(u => u.email_confirmed_at).length;
  // Atenção: esta flag também é gravada por quem aperta "Pular tudo" na tela 0.
  // Por isso ela NÃO é apresentada como "completou" — ver `finishedOrSkipped`.
  const finishedOrSkipped = population.filter(
    u => u.user_metadata?.onboarding_completed === true,
  ).length;

  // ─── 1. FUNIL POR EVENTOS ─────────────────────────────────────
  // A tabela pode não existir ainda (migration não rodada) — nesse caso o bloco
  // volta vazio com available:false e o painel mostra o aviso, em vez de 500.
  let eventsAvailable = false;
  let eventsSince: string | null = null;
  let eventTotal = 0;
  const stepStats = new Map<string, { reached: Set<string>; skipped: Set<string>; users: Set<string> }>();
  const firstSeen = new Map<string, number>();   // anon_id → ts do 1º evento
  const finishedAt = new Map<string, number>();  // anon_id → ts do onb_done

  {
    let q = admin
      .from('onboarding_events')
      .select('anon_id, user_id, step, action, created_at')
      .order('created_at', { ascending: true })
      .limit(200000);
    if (cohort !== 'all') q = q.gte('created_at', start.toISOString());
    const { data: events, error } = await q;

    if (!error && events) {
      eventsAvailable = events.length > 0;
      eventTotal = events.length;
      eventsSince = events[0]?.created_at ?? null;
      for (const e of events) {
        const bucket = stepStats.get(e.step) ?? { reached: new Set(), skipped: new Set(), users: new Set() };
        if (e.action === 'view') bucket.reached.add(e.anon_id);
        if (e.action === 'skip') bucket.skipped.add(e.anon_id);
        if (e.user_id) bucket.users.add(e.user_id);
        stepStats.set(e.step, bucket);

        const ts = Date.parse(e.created_at);
        const prev = firstSeen.get(e.anon_id);
        if (prev === undefined || ts < prev) firstSeen.set(e.anon_id, ts);
        if (e.step === 'onb_done') finishedAt.set(e.anon_id, ts);
      }
    }
  }

  // A queda é medida DENTRO da fase. Em linha reta, o 1º passo pós-cadastro
  // seria comparado com o último passo pré-cadastro e TODO mundo que nunca criou
  // conta apareceria como vazamento das boas-vindas. Troca de fase → base zerada,
  // e o primeiro passo da fase abre sem queda.
  let prevReached: number | null = null;
  let prevPhase: 'pre' | 'post' | null = null;
  const eventFunnel = ONBOARDING_STEPS.map(def => {
    if (def.phase !== prevPhase) {
      prevReached = null;
      prevPhase = def.phase;
    }
    const s = stepStats.get(def.key);
    const reached = s?.reached.size ?? 0;
    const dropped = prevReached === null ? 0 : Math.max(0, prevReached - reached);
    const row = {
      key: def.key,
      label: def.label,
      phase: def.phase,
      skippable: def.skippable ?? false,
      reached,
      skipped: s?.skipped.size ?? 0,
      identified: s?.users.size ?? 0,
      droppedFromPrev: dropped,
      dropPct: prevReached ? rate(dropped, prevReached) : 0,
    };
    // Passo sem NENHUM evento não vira "queda": ou não foi instrumentado ainda,
    // ou ninguém passou por ele (paywall na web, p.ex.). Não polui a base do
    // próximo passo com um zero artificial.
    if (reached > 0) prevReached = reached;
    return row;
  });

  // Tempo do 1º evento até entrar no app (mediana, em minutos).
  const durations = [...finishedAt.entries()]
    .map(([anon, end]) => {
      const begin = firstSeen.get(anon);
      return begin ? (end - begin) / 60000 : null;
    })
    .filter((v): v is number => v !== null && v >= 0)
    .sort((a, b) => a - b);
  const medianMinutes = durations.length
    ? Math.round(durations[Math.floor(durations.length / 2)] * 10) / 10
    : null;

  // ─── 2. FUNIL DERIVADO (retroativo) ───────────────────────────
  const [recurring, cards, plans, assets, expenses, missions, subs, activity] = await Promise.all([
    admin.from('recurring_expenses').select('user_id, type, description'),
    admin.from('credit_cards').select('user_id'),
    admin.from('monthly_plans').select('user_id, savings_goal'),
    admin.from('assets').select('user_id'),
    admin.from('expenses').select('user_id, category, date, created_at'),
    admin.from('savings_missions').select('user_id, status'),
    admin.from('subscriptions').select('user_id, plan, status, billing_cycle, created_at, store'),
    admin.from('user_activity').select('user_id, active_date'),
  ]);

  const mine = <T extends { user_id: string }>(rows: T[] | null) =>
    (rows ?? []).filter(r => ids.has(r.user_id));

  const withIncome = new Set(
    mine(recurring.data).filter(r => r.type === 'income' && /sal[áa]rio/i.test(r.description ?? '')).map(r => r.user_id),
  );
  const withRecurring = new Set(mine(recurring.data).filter(r => r.type === 'expense').map(r => r.user_id));
  const withCard = new Set(mine(cards.data).map(r => r.user_id));
  const withGoal = new Set(mine(plans.data).filter(p => Number(p.savings_goal) > 0).map(p => p.user_id));

  const myExpenses = mine(expenses.data);
  const withFinance = new Set([
    ...mine(assets.data).map(r => r.user_id),
    ...myExpenses.filter(e => e.category === 'Saldo inicial').map(e => e.user_id),
  ]);
  // "Lançou de verdade" = qualquer lançamento que NÃO seja o saldo inicial
  // criado pelo próprio onboarding. Sem isso todo mundo que passou pelo passo 5
  // apareceria como usuário ativo.
  const withRealLaunch = new Set(
    myExpenses.filter(e => e.category !== 'Saldo inicial').map(e => e.user_id),
  );
  const withMission = new Set(
    mine(missions.data).filter(m => m.status === 'active').map(m => m.user_id),
  );

  // ─── 3. CONVERSÃO ─────────────────────────────────────────────
  const mySubs = mine(subs.data);
  const PAID_CYCLES = new Set(['monthly', 'annual']);
  // Pagante DE VERDADE: assinatura ativa com ciclo de loja. 'manual'/'beta'/
  // 'coupon' são cortesia — contam à parte e jamais entram na taxa.
  const payers = mySubs.filter(
    s => s.plan === 'pro' && s.status === 'active' && PAID_CYCLES.has(s.billing_cycle ?? ''),
  );
  const courtesy = mySubs.filter(
    s => s.plan === 'pro' && s.status === 'active' && !PAID_CYCLES.has(s.billing_cycle ?? ''),
  );
  const churned = mySubs.filter(
    s => s.status === 'cancelled' && PAID_CYCLES.has(s.billing_cycle ?? ''),
  );

  const payerList = payers.map(s => ({
    user_id: s.user_id,
    email: emailOf.get(s.user_id) ?? '—',
    billing_cycle: s.billing_cycle,
    store: s.store ?? null,
    since: s.created_at,
    // Dias entre criar a conta e assinar. 0 = assinou no mesmo dia.
    daysToPay: createdAtOf.has(s.user_id) && s.created_at
      ? daysBetween(new Date(s.created_at), createdAtOf.get(s.user_id)!)
      : null,
  })).sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''));

  // ─── 4. RETENÇÃO ──────────────────────────────────────────────
  const activeDays = new Map<string, string[]>();
  for (const a of mine(activity.data)) {
    if (!activeDays.has(a.user_id)) activeDays.set(a.user_id, []);
    activeDays.get(a.user_id)!.push(a.active_date);
  }

  let returned = 0;          // voltou em pelo menos 1 dia DEPOIS do cadastro
  let activeLast7 = 0;
  const dN = { d1: { hit: 0, eligible: 0 }, d7: { hit: 0, eligible: 0 }, d30: { hit: 0, eligible: 0 } };

  for (const u of population) {
    const created = new Date(u.created_at);
    const signupDay = dayKey(created);
    const days = (activeDays.get(u.id) ?? []).slice().sort();
    if (days.some(d => d > signupDay)) returned++;
    if (days.some(d => daysBetween(now, new Date(`${d}T12:00:00-03:00`)) <= 7)) activeLast7++;

    const age = daysBetween(now, created);
    for (const [k, n] of [['d1', 1], ['d7', 7], ['d30', 30]] as const) {
      if (age < n) continue; // ainda não teve chance de voltar nesse dia
      dN[k].eligible++;
      const targetDay = dayKey(new Date(created.getTime() + n * DAY_MS));
      if (days.includes(targetDay)) dN[k].hit++;
    }
  }

  // ─── SÉRIE DIÁRIA ─────────────────────────────────────────────
  const daily = new Map<string, { day: string; signups: number; confirmed: number; finished: number; payers: number }>();
  const touch = (day: string) => {
    if (!daily.has(day)) daily.set(day, { day, signups: 0, confirmed: 0, finished: 0, payers: 0 });
    return daily.get(day)!;
  };
  for (const u of population) {
    const row = touch(dayKey(new Date(u.created_at)));
    row.signups++;
    if (u.email_confirmed_at) row.confirmed++;
    if (u.user_metadata?.onboarding_completed === true) row.finished++;
  }
  for (const p of payers) {
    if (p.created_at) touch(dayKey(new Date(p.created_at))).payers++;
  }

  // ─── QUEM TRAVOU (lista de ação) ──────────────────────────────
  const stuck = population
    .filter(u => !withRealLaunch.has(u.id))
    .map(u => {
      const created = new Date(u.created_at);
      return {
        user_id: u.id,
        email: u.email ?? '—',
        created_at: u.created_at,
        daysSince: daysBetween(now, created),
        confirmed: !!u.email_confirmed_at,
        reachedStep:
          !u.email_confirmed_at ? 'Não confirmou o e-mail'
          : withFinance.has(u.id) ? 'Terminou o onboarding e parou'
          : withGoal.has(u.id) ? 'Parou na meta (passo 4)'
          : withCard.has(u.id) ? 'Parou nos cartões (passo 3)'
          : withRecurring.has(u.id) ? 'Parou nas contas fixas (passo 2)'
          : withIncome.has(u.id) ? 'Parou na renda (passo 1)'
          : 'Não passou da tela de boas-vindas',
      };
    })
    .sort((a, b) => a.daysSince - b.daysSince);

  return NextResponse.json({
    cohort: {
      mode: cohort,
      startDay: COHORT_START_DAY,
      users: total,
      legacyExcluded: cohort === 'all' ? 0 : legacyCount,
      totalInDatabase: allUsers.length,
    },
    events: {
      available: eventsAvailable,
      since: eventsSince,
      total: eventTotal,
      medianMinutesToFinish: medianMinutes,
      steps: eventFunnel,
    },
    derived: {
      steps: [
        { key: 'signup',    label: 'Criou a conta',            count: total },
        { key: 'confirmed', label: 'Confirmou o e-mail',       count: confirmed },
        { key: 'income',    label: '1 · Informou a renda',     count: withIncome.size },
        { key: 'recurring', label: '2 · Cadastrou contas fixas', count: withRecurring.size },
        { key: 'cards',     label: '3 · Cadastrou cartão',     count: withCard.size },
        { key: 'goal',      label: '4 · Definiu meta',         count: withGoal.size },
        { key: 'finance',   label: '5 · Situação financeira',  count: withFinance.size },
        { key: 'finished',  label: 'Saiu do onboarding',       count: finishedOrSkipped },
        { key: 'launch',    label: 'Lançou algo por conta própria', count: withRealLaunch.size },
        { key: 'mission',   label: 'Criou missão de poupança', count: withMission.size },
        { key: 'pro',       label: 'Virou Pro pagante',        count: payers.length },
      ],
    },
    conversion: {
      signups: total,
      payers: payers.length,
      rate: rate(payers.length, total),
      courtesy: courtesy.length,
      churned: churned.length,
      payerList,
    },
    retention: {
      returned,
      returnedRate: rate(returned, total),
      activeLast7,
      activeLast7Rate: rate(activeLast7, total),
      d1: { ...dN.d1, rate: rate(dN.d1.hit, dN.d1.eligible) },
      d7: { ...dN.d7, rate: rate(dN.d7.hit, dN.d7.eligible) },
      d30: { ...dN.d30, rate: rate(dN.d30.hit, dN.d30.eligible) },
    },
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    stuck,
  });
}
