import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  // RLS já restringe SELECT às próprias linhas (auth.uid() = user_id / id).
  const [
    expensesRes,
    recurringRes,
    plansRes,
    budgetsRes,
    cardsRes,
    obligationsRes,
    goalsRes,
    goalContribsRes,
    assetsRes,
    liabilitiesRes,
    missionsRes,
    missionContribsRes,
    missionBadgesRes,
    profileRes,
  ] = await Promise.all([
    supabase.from('expenses').select('*'),
    supabase.from('recurring_expenses').select('*'),
    supabase.from('monthly_plans').select('*'),
    supabase.from('budgets').select('*'),
    supabase.from('credit_cards').select('id, nome, limite, dia_fechamento, dia_vencimento, ativo, created_at'),
    supabase.from('monthly_obligations').select('*'),
    supabase.from('goals').select('*'),
    supabase.from('goal_contributions').select('*'),
    supabase.from('assets').select('*'),
    supabase.from('liabilities').select('*'),
    supabase.from('savings_missions').select('*'),
    supabase.from('mission_contributions').select('*'),
    supabase.from('mission_badges').select('*'),
    supabase
      .from('profiles')
      .select('id, avatar_url, avatar_emoji, notification_preferences, email_report_weekly, email_report_monthly, push_due_tomorrow, push_budget_exceeded, push_weekly_summary, marketing_consent, terms_accepted_at, updated_at')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email ?? null,
      display_name: (meta.display_name as string | undefined) ?? null,
      created_at: user.created_at ?? null,
    },
    financialData: {
      expenses: expensesRes.data ?? [],
      recurring_expenses: recurringRes.data ?? [],
      monthly_plans: plansRes.data ?? [],
      budgets: budgetsRes.data ?? [],
      credit_cards: cardsRes.data ?? [],
      monthly_obligations: obligationsRes.data ?? [],
      goals: goalsRes.data ?? [],
      goal_contributions: goalContribsRes.data ?? [],
      assets: assetsRes.data ?? [],
      liabilities: liabilitiesRes.data ?? [],
    },
    missions: {
      savings_missions: missionsRes.data ?? [],
      mission_contributions: missionContribsRes.data ?? [],
      mission_badges: missionBadgesRes.data ?? [],
    },
    profile: profileRes.data ?? null,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="meus-dados-toorganizado.json"',
      'Cache-Control': 'no-store',
    },
  });
}
