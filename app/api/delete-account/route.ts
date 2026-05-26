import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { confirm?: boolean };
  if (!body.confirm) {
    return NextResponse.json({ error: 'Confirmação necessária.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
  }

  // Ordem respeita FKs: filhos antes de pais.
  //  - goal_contributions → goals
  //  - mission_contributions/challenges/badges → savings_missions
  //  - profiles ON DELETE CASCADE → savings_missions (e cadeia abaixo)
  //  - auth.users ON DELETE CASCADE → várias (subscriptions, push_subscriptions,
  //    push_notification_log, feedback, gastobot_usage), mas deletamos explícito
  //    aqui por LGPD/auditabilidade.
  const userOwnedTables = [
    'goal_contributions',
    'mission_contributions',
    'mission_challenges',
    'mission_badges',
    'expenses',
    'recurring_expenses',
    'budgets',
    'monthly_plans',
    'credit_cards',
    'monthly_obligations',
    'goals',
    'assets',
    'liabilities',
    'savings_missions',
    'push_subscriptions',
    'push_notification_log',
    'feedback',
    'gastobot_usage',
    'subscriptions',
  ];

  for (const table of userOwnedTables) {
    await admin.from(table).delete().eq('user_id', user.id);
  }

  // push_history usa created_by (admin que disparou o push). Remove registros
  // do próprio usuário caso ele tenha sido admin.
  await admin.from('push_history').delete().eq('created_by', user.id);

  // coupons: preservar o cupom em si, apenas desvincular o admin criador.
  await admin.from('coupons').update({ created_by: null }).eq('created_by', user.id);

  // profiles usa coluna id (FK para auth.users).
  await admin.from('profiles').delete().eq('id', user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: 'Erro ao excluir conta. Tente novamente.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
