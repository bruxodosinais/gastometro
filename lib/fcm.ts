import type { SupabaseClient } from '@supabase/supabase-js';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { PushPayload } from './push';

// Transporte FCM (nativo iOS/Android), em PARALELO ao web push. O "cérebro"
// (quem/quando/dedup) segue em lib/push.ts — aqui é só o segundo cano de entrega.
// Server-only (firebase-admin é Node): importado apenas pelas rotas /api, que o
// build nativo stasha, então nunca entra no bundle client web/nativo.

interface DeviceTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
}

// Limite do sendEachForMulticast do FCM: 500 mensagens por chamada.
const FCM_BATCH = 500;

// Códigos de erro do FCM que significam token morto → prune do device_tokens
// (espelha o prune do web push em 404/410).
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

let fcmApp: App | null = null;
let fcmUnavailable = false;

// Inicializa o firebase-admin (singleton) a partir do service account em
// FIREBASE_SERVICE_ACCOUNT_BASE64 (base64 → JSON → cert()). Degrada gracioso:
// sem a env (ou JSON inválido) retorna null e loga UMA vez — o envio vira no-op
// e o web push NÃO é afetado (ao contrário do ensureVapidConfigured, que lança).
function ensureFcmConfigured(): App | null {
  if (fcmApp) return fcmApp;
  if (fcmUnavailable) return null;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) {
    fcmUnavailable = true;
    console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT_BASE64 ausente — envio FCM desativado (web push segue normal).');
    return null;
  }

  try {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    fcmApp = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(json) });
    return fcmApp;
  } catch (err) {
    fcmUnavailable = true;
    console.error('[fcm] service account inválido — envio FCM desativado:', err);
    return null;
  }
}

export async function getDeviceTokensForUsers(
  admin: SupabaseClient,
  userIds: string[],
): Promise<DeviceTokenRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from('device_tokens')
    .select('id, user_id, token, platform')
    .in('user_id', userIds);
  if (error) {
    console.error('[fcm] erro listando device_tokens:', error);
    return [];
  }
  return (data ?? []) as DeviceTokenRow[];
}

/**
 * Envia um push via FCM para a lista de tokens e remove do banco os que o FCM
 * marcar como não registrados. Resiliente: sem config ou em qualquer falha,
 * retorna zeros e NÃO lança — o web push nunca pode regredir por causa do FCM.
 * Faz chunking de 500 (limite do sendEachForMulticast).
 */
export async function sendFcmToTokens(
  admin: SupabaseClient,
  tokens: DeviceTokenRow[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0, pruned: 0 };
  const app = ensureFcmConfigured();
  if (!app) return { sent: 0, failed: 0, pruned: 0 };

  const messaging = getMessaging(app);
  let sent = 0;
  let failed = 0;
  const deadTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += FCM_BATCH) {
    const chunk = tokens.slice(i, i + FCM_BATCH);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        notification: { title: payload.title, body: payload.message },
        ...(payload.url ? { data: { url: payload.url } } : {}),
      });
      res.responses.forEach((r, idx) => {
        if (r.success) {
          sent += 1;
        } else {
          failed += 1;
          if (r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
            deadTokens.push(chunk[idx].token);
          }
        }
      });
    } catch (err) {
      // Falha do chunk inteiro (rede/credencial) — conta como failed, não derruba
      // o web push nem os outros chunks.
      console.error('[fcm] erro no envio de um chunk:', err);
      failed += chunk.length;
    }
  }

  if (deadTokens.length > 0) {
    await admin.from('device_tokens').delete().in('token', deadTokens);
  }

  return { sent, failed, pruned: deadTokens.length };
}
