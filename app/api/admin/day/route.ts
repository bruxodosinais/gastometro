import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

// Resumo de UM dia do calendário brasileiro: quantas contas nasceram, quantas
// pessoas usaram o app e o que elas fizeram. Serve para casar um pico de
// cadastros com o dia em que a campanha rodou.
//
// FUSO — o detalhe que decide se o número está certo:
//   · `created_at` (auth.users, expenses, feedback, device_tokens) é UTC.
//   · `user_activity.active_date` é DATE gravado pelo CLIENTE (todayLocalStr em
//     lib/storage/activity.ts), ou seja, no calendário de quem usou o app.
// Para os dois falarem do mesmo "dia", o dia BRT pedido vira uma JANELA UTC:
// 2026-08-26 no Brasil = [2026-08-26T03:00Z, 2026-08-27T03:00Z).
// O Brasil não usa horário de verão desde 2019, então o offset -3 é fixo.
const BRT_OFFSET_HOURS = 3;

function brtDayWindow(dateStr: string): { startUtc: string; endUtc: string; startMs: number; endMs: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const start = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  start.setUTCHours(start.getUTCHours() + BRT_OFFSET_HOURS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}

// Compara INSTANTES, nunca strings: o Postgres devolve "…+00:00" e o
// toISOString() gera "…Z", então uma comparação lexicográfica entre os dois
// formatos é traiçoeira (o '+' ordena antes do '.' das frações de segundo).
const inWindow = (ts: string | null | undefined, startMs: number, endMs: number) => {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return !Number.isNaN(t) && t >= startMs && t < endMs;
};

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const date = req.nextUrl.searchParams.get('date') ?? '';
  const win = brtDayWindow(date);
  if (!win) {
    return NextResponse.json({ error: 'Data inválida. Use o formato AAAA-MM-DD.' }, { status: 400 });
  }
  const { startUtc, endUtc, startMs, endMs } = win;

  const admin = createAdminClient();

  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const emailById = new Map<string, string>();
  for (const u of allUsers) if (u.email) emailById.set(u.id, u.email);

  // Contas criadas e e-mails confirmados dentro da janela.
  const signups = allUsers.filter(u => inWindow(u.created_at, startMs, endMs));
  const confirmed = allUsers.filter(u => inWindow(u.email_confirmed_at, startMs, endMs));

  // Lançamentos REGISTRADOS no dia. Usa `created_at` (quando a pessoa digitou),
  // não `date` (quando o gasto aconteceu) — só o primeiro é uma ação do dia.
  const { data: expenses } = await admin
    .from('expenses')
    .select('user_id, created_at, type, amount')
    .gte('created_at', startUtc)
    .lt('created_at', endUtc);
  const launchUsers = new Set((expenses ?? []).map(e => e.user_id));

  // Acessos: quem abriu o app nesse dia (base do streak). Comparação direta
  // com o DATE, que já está no calendário local de quem acessou.
  const { data: activity } = await admin
    .from('user_activity')
    .select('user_id')
    .eq('active_date', date);
  const activeUsers = new Set((activity ?? []).map(a => a.user_id));

  // Assinaturas mexidas no dia. `updated_at` é o carimbo que o webhook do
  // RevenueCat toca a cada evento.
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id, plan, status, billing_cycle, store, updated_at')
    .gte('updated_at', startUtc)
    .lt('updated_at', endUtc);
  const upgrades = (subs ?? []).filter(s => s.plan === 'pro' && s.status === 'active');
  const cancels = (subs ?? []).filter(s => s.plan !== 'pro' || s.status !== 'active');

  // Push ativado no dia, separado por plataforma.
  const { data: tokens } = await admin
    .from('device_tokens')
    .select('user_id, platform, created_at')
    .gte('created_at', startUtc)
    .lt('created_at', endUtc);
  const pushIos = (tokens ?? []).filter(t => t.platform === 'ios').length;
  const pushAndroid = (tokens ?? []).filter(t => t.platform === 'android').length;

  const { data: feedbacks } = await admin
    .from('feedback')
    .select('id, user_id, category, message, created_at')
    .gte('created_at', startUtc)
    .lt('created_at', endUtc);

  // Linha do tempo do dia, do mais recente para o mais antigo.
  type DayEvent = {
    id: string;
    type: 'signup' | 'upgrade' | 'cancel' | 'feedback';
    email: string | null;
    description: string;
    created_at: string;
  };
  const events: DayEvent[] = [];

  for (const u of signups) {
    events.push({
      id: `signup:${u.id}`,
      type: 'signup',
      email: u.email ?? null,
      description: `${u.email ?? 'usuário'} criou a conta`,
      created_at: u.created_at,
    });
  }
  for (const s of upgrades) {
    const email = emailById.get(s.user_id) ?? null;
    const origem = s.store === 'app_store' ? 'App Store'
      : s.store === 'play_store' ? 'Play Store'
        : s.billing_cycle ?? 'sem ciclo';
    events.push({
      id: `upgrade:${s.user_id}:${s.updated_at}`,
      type: 'upgrade',
      email,
      description: `${email ?? 'usuário'} virou Pro (${origem})`,
      created_at: s.updated_at ?? startUtc,
    });
  }
  for (const s of cancels) {
    const email = emailById.get(s.user_id) ?? null;
    events.push({
      id: `cancel:${s.user_id}:${s.updated_at}`,
      type: 'cancel',
      email,
      description: `${email ?? 'usuário'} deixou de ser Pro (${s.status})`,
      created_at: s.updated_at ?? startUtc,
    });
  }
  for (const f of feedbacks ?? []) {
    const email = f.user_id ? emailById.get(f.user_id) ?? null : null;
    events.push({
      id: `feedback:${f.id}`,
      type: 'feedback',
      email,
      description: `${email ?? 'anônimo'} enviou feedback (${f.category})`,
      created_at: f.created_at,
    });
  }
  // Mesmo cuidado do inWindow: ordena por instante, não por texto.
  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    date,
    window: { startUtc, endUtc },
    totals: {
      signups: signups.length,
      confirmed: confirmed.length,
      activeUsers: activeUsers.size,
      launches: (expenses ?? []).length,
      launchUsers: launchUsers.size,
      upgrades: upgrades.length,
      cancels: cancels.length,
      pushIos,
      pushAndroid,
      feedbacks: (feedbacks ?? []).length,
    },
    events,
  });
}
