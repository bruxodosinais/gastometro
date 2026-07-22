import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';
import { isAllowedWebOrigin } from '@/lib/cors';

// Origens de desenvolvimento — nunca válidas em produção.
const DEV_ORIGINS = new Set(['http://localhost:3000', 'http://localhost:3001']);

// O botão de export é <a download>, ou seja, navegação same-origin: o browser NÃO
// manda Origin, só Referer. Por isso o Referer é reduzido à origem (ele vem com
// caminho, ex. https://host/admin) e comparado por igualdade — a allowlist é a
// canônica de lib/cors.ts, que tem apex e www.
function requestOrigin(req: NextRequest): string | null {
  const origin = req.headers.get('origin');
  if (origin) return origin;
  const referer = req.headers.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null; // Referer malformado → não permitido
  }
}

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const isAllowed =
    isAllowedWebOrigin(origin) ||
    (process.env.NODE_ENV !== 'production' && origin !== null && DEV_ORIGINS.has(origin));
  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const admin = createAdminClient();
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });

  const { data: blocks } = await admin.from('user_blocks').select('user_id');
  const blockedSet = new Set(blocks?.map(b => b.user_id) ?? []);
  const { data: expenses } = await admin.from('expenses').select('user_id');
  const launchCount: Record<string, number> = {};
  for (const e of (expenses ?? [])) launchCount[e.user_id] = (launchCount[e.user_id] ?? 0) + 1;
  const { data: recurringRows } = await admin.from('recurring_expenses').select('user_id');
  const recurringSet = new Set(recurringRows?.map(r => r.user_id) ?? []);
  const { data: cardRows } = await admin.from('credit_cards').select('user_id');
  const cardSet = new Set(cardRows?.map(r => r.user_id) ?? []);

  console.log('[admin:export]', {
    adminUserId: user.id,
    exportedAt: new Date().toISOString(),
    rowCount: allUsers.length,
    ip: req.headers.get('x-forwarded-for') ?? 'unknown',
  });

  const header = 'id,email,cadastro,confirmado,ultimo_acesso,lancamentos,tem_recorrente,tem_cartao,bloqueado\n';
  const rows = allUsers.map(u => [
    u.id,
    `"${u.email ?? ''}"`,
    u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : '',
    u.email_confirmed_at ? 'sim' : 'não',
    u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString().split('T')[0] : '',
    launchCount[u.id] ?? 0,
    recurringSet.has(u.id) ? 'sim' : 'não',
    cardSet.has(u.id) ? 'sim' : 'não',
    blockedSet.has(u.id) ? 'sim' : 'não',
  ].join(',')).join('\n');

  const csv = header + rows;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="usuarios-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
