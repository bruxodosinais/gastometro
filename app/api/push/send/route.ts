import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';
import {
  getSubscriptionsForUsers,
  logPushHistory,
  sendPushToSubscriptions,
} from '@/lib/push';

export const maxDuration = 60;

type Target = 'all' | 'pro' | 'free' | 'user';

interface Body {
  title?: string;
  message?: string;
  url?: string;
  target?: Target;
  userId?: string;
}

const MAX_TITLE = 50;
const MAX_MESSAGE = 120;

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const isCronCall = !!expected && authHeader === `Bearer ${expected}`;

  let adminUserId: string | null = null;

  if (!isCronCall) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }
    adminUserId = user.id;
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const title = (body.title ?? '').trim();
  const message = (body.message ?? '').trim();
  const url = (body.url ?? '/app').trim() || '/app';
  const target: Target = body.target ?? (body.userId ? 'user' : 'all');
  const userId = body.userId?.trim();

  if (!title) return NextResponse.json({ error: 'Título obrigatório.' }, { status: 400 });
  if (!message) return NextResponse.json({ error: 'Mensagem obrigatória.' }, { status: 400 });
  if (title.length > MAX_TITLE) {
    return NextResponse.json({ error: `Título excede ${MAX_TITLE} caracteres.` }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: `Mensagem excede ${MAX_MESSAGE} caracteres.` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve lista de user_ids alvo.
  let targetUserIds: string[] = [];
  if (target === 'user') {
    if (!userId) {
      return NextResponse.json({ error: 'userId obrigatório quando target=user.' }, { status: 400 });
    }
    targetUserIds = [userId];
  } else if (target === 'all') {
    const { data } = await admin.from('push_subscriptions').select('user_id');
    const uniq = new Set<string>();
    for (const r of data ?? []) uniq.add(r.user_id as string);
    targetUserIds = Array.from(uniq);
  } else {
    // 'pro' | 'free' — filtra pelo plano via subscriptions.
    const { data: subs } = await admin
      .from('subscriptions')
      .select('user_id, plan, status');
    targetUserIds = (subs ?? [])
      .filter((s) => {
        const isProActive = s.plan === 'pro' && s.status === 'active';
        return target === 'pro' ? isProActive : !isProActive;
      })
      .map((s) => s.user_id as string);
  }

  if (targetUserIds.length === 0) {
    await logPushHistory(admin, {
      title, message, target, sent: 0, failed: 0, createdBy: adminUserId,
    });
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  const subscriptions = await getSubscriptionsForUsers(admin, targetUserIds);
  const result = await sendPushToSubscriptions(admin, subscriptions, { title, message, url });

  await logPushHistory(admin, {
    title,
    message,
    target,
    sent: result.sent,
    failed: result.failed,
    createdBy: adminUserId,
  });

  return NextResponse.json({
    sent: result.sent,
    failed: result.failed,
    total: subscriptions.length,
    pruned: result.pruned,
  });
}
