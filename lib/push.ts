import webpush, { type WebPushError } from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PushPayload {
  title: string;
  message: string;
  url?: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const mailto = process.env.VAPID_MAILTO ?? 'noreply@toorganizado.com.br';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys ausentes (NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).');
  }
  webpush.setVapidDetails(`mailto:${mailto}`, publicKey, privateKey);
  vapidConfigured = true;
}

/**
 * Envia um push para a lista de subscriptions e remove do banco as que tiverem
 * sido invalidadas pelo endpoint (HTTP 404/410).
 */
export async function sendPushToSubscriptions(
  admin: SupabaseClient,
  subscriptions: SubscriptionRow[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (subscriptions.length === 0) return { sent: 0, failed: 0, pruned: 0 };
  ensureVapidConfigured();

  const body = JSON.stringify(payload);
  const invalidIds: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
        sent += 1;
      } catch (err) {
        const e = err as WebPushError;
        const status = typeof e?.statusCode === 'number' ? e.statusCode : 0;
        if (status === 404 || status === 410) {
          invalidIds.push(sub.id);
        }
        failed += 1;
      }
    })
  );

  if (invalidIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', invalidIds);
  }

  return { sent, failed, pruned: invalidIds.length };
}

export async function getSubscriptionsForUsers(
  admin: SupabaseClient,
  userIds: string[]
): Promise<SubscriptionRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);
  if (error) {
    console.error('[push] erro listando subscriptions:', error);
    return [];
  }
  return (data ?? []) as SubscriptionRow[];
}

export async function logPushHistory(
  admin: SupabaseClient,
  entry: {
    title: string;
    message: string;
    target: string;
    sent: number;
    failed: number;
    createdBy?: string | null;
  }
): Promise<void> {
  const { error } = await admin.from('push_history').insert({
    title: entry.title,
    message: entry.message,
    target: entry.target,
    sent_count: entry.sent,
    failed_count: entry.failed,
    created_by: entry.createdBy ?? null,
  });
  if (error) console.error('[push] erro registrando histórico:', error);
}
