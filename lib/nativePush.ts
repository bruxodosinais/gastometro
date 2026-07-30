import { fetchApi } from '@/lib/fetchApi';
import { isNativePlatform } from '@/lib/native';

// Registro de push NATIVO (FCM), em paralelo ao Web Push (VAPID) que segue na web.
// 🔴 WEB-SAFE: o @capacitor-firebase/messaging entra SÓ por import dinâmico dentro
// de guard isNativePlatform() — nunca por import estático de topo. Assim ele vira
// um chunk lazy que a web NUNCA carrega (o bundle web sai byte-idêntico).

type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

// Só liga o listener de refresh de token uma vez por sessão do app.
let refreshListenerBound = false;

// Plataforma pelo global do Capacitor (sem importar @capacitor/core estático).
function nativePlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = typeof cap?.getPlatform === 'function' ? cap.getPlatform() : 'web';
  return p === 'ios' || p === 'android' ? p : 'web';
}

async function loadMessaging() {
  const mod = await import('@capacitor-firebase/messaging');
  return mod.FirebaseMessaging;
}

function mapPerm(receive: string): PermState {
  if (receive === 'granted') return 'granted';
  if (receive === 'denied') return 'denied';
  return 'default'; // 'prompt' | 'prompt-with-rationale'
}

// Envia o token pra /api/push/subscribe (fetchApi injeta o Bearer no nativo).
async function postToken(token: string): Promise<boolean> {
  const platform = nativePlatform();
  if (platform !== 'ios' && platform !== 'android') return false;
  const res = await fetchApi('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  });
  return res.ok;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bindRefreshListener(FirebaseMessaging: any): Promise<void> {
  if (refreshListenerBound) return;
  refreshListenerBound = true;
  // Token pode rodar (reinstall, restore, etc.) — re-registra o novo no backend.
  await FirebaseMessaging.addListener('tokenReceived', async (event: { token?: string }) => {
    if (event?.token) {
      try { await postToken(event.token); } catch { /* re-tenta no próximo boot */ }
    }
  });
}

// Pega o token atual e registra no backend + liga o listener de refresh.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTokenRegistered(FirebaseMessaging: any): Promise<boolean> {
  await bindRefreshListener(FirebaseMessaging);
  const { token } = await FirebaseMessaging.getToken();
  if (!token) return false;
  return postToken(token);
}

// Estado ao montar (sem pedir permissão). Se já concedida, reafirma o token no
// backend (mantém a device_tokens fresca) e considera "inscrito".
export async function nativeInit(): Promise<{ permission: PermState; subscribed: boolean }> {
  if (!isNativePlatform()) return { permission: 'unsupported', subscribed: false };
  try {
    const FirebaseMessaging = await loadMessaging();
    const { receive } = await FirebaseMessaging.checkPermissions();
    const permission = mapPerm(receive);
    if (permission !== 'granted') return { permission, subscribed: false };
    const subscribed = await ensureTokenRegistered(FirebaseMessaging);
    return { permission, subscribed };
  } catch (err) {
    console.error('[nativePush] init falhou:', err);
    return { permission: 'default', subscribed: false };
  }
}

// Pede permissão (prompt) e registra o token. Chamado pelo botão "Ativar".
export async function nativeRegister(): Promise<{ ok: boolean; permission: PermState }> {
  if (!isNativePlatform()) return { ok: false, permission: 'unsupported' };
  try {
    const FirebaseMessaging = await loadMessaging();
    const { receive } = await FirebaseMessaging.requestPermissions();
    const permission = mapPerm(receive);
    if (permission !== 'granted') return { ok: false, permission };
    const ok = await ensureTokenRegistered(FirebaseMessaging);
    return { ok, permission };
  } catch (err) {
    console.error('[nativePush] register falhou:', err);
    return { ok: false, permission: 'default' };
  }
}

// "Desativar" nesta fase = deleteToken() LOCAL apenas. A linha em device_tokens é
// podada no próximo envio (o FCM devolve registration-token-not-registered). O
// delete no backend/logout fica pra fase futura (fora de escopo aqui).
export async function nativeUnregister(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const FirebaseMessaging = await loadMessaging();
    await FirebaseMessaging.deleteToken();
    return true;
  } catch (err) {
    console.error('[nativePush] unregister falhou:', err);
    return false;
  }
}
