import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from('feedback')
    .select('id, user_id, category, message, page, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar feedbacks.' }, { status: 500 });
  }

  const userIds = Array.from(new Set((rows ?? []).map(r => r.user_id).filter(Boolean))) as string[];

  // auth.admin.listUsers is paginated; for our scale, fetch all once and filter.
  const emails = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 10000 });
    for (const u of users) {
      if (u.email) emails.set(u.id, u.email);
    }
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const unreadCount = (rows ?? []).filter(r => new Date(r.created_at).getTime() >= sevenDaysAgo).length;

  const items = (rows ?? []).map(r => ({
    id: r.id,
    user_id: r.user_id,
    email: r.user_id ? (emails.get(r.user_id) ?? null) : null,
    category: r.category,
    message: r.message,
    page: r.page,
    created_at: r.created_at,
  }));

  return NextResponse.json({ items, unreadCount });
}
