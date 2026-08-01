import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { fetchApi } from '@/lib/fetchApi';
import { isNativePlatform } from '@/lib/native';

// Registro de push NATIVO (FCM), em paralelo ao Web Push (VAPID) que segue na web.
// 🔴 WEB-SAFE: o import do plugin é ESTÁTICO, mas só puxa o proxy leve do
// registerPlugin. O firebase (pesado) vive no web.js do plugin, que o PRÓPRIO
// Capacitor carrega por dynamic import (`web: () => import('./web')`) apenas na
// web e só quando um método é chamado. Como todas as chamadas aqui são guardadas
// por isNativePlatform(), o firebase nunca é carregado na web → bundle eager limpo.
// (O import() dinâmico que tínhamos antes travava dentro do WKWebView.)

type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

// Liga o listener de refresh de token uma vez por sessão do app.
let refreshListenerBound = false;

// Plataforma pelo global do Capacitor (sem importar @capacitor/core estático).
function nativePlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = typeof cap?.getPlatform === 'function' ? cap.getPlatform() : 'web';
  return p === 'ios' || p === 'android' ? p : 'web';
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

// Token pode rodar (reinstall, restore, etc.) — re-registra o novo no backend.
async function bindRefreshListener(): Promise<void> {
  if (refreshListenerBound) return;
  refreshListenerBound = true;
  await FirebaseMessaging.addListener('tokenReceived', async (event) => {
    if (event?.token) {
      try { await postToken(event.token); } catch { /* re-tenta no próximo boot */ }
    }
  });
}

// Pega o token atual e registra no backend + liga o listener de refresh.
async function ensureTokenRegistered(): Promise<boolean> {
  await bindRefreshListener();
  const { token } = await FirebaseMessaging.getToken();
  if (!token) return false;
  return postToken(token);
}

// Estado ao montar (sem pedir permissão). Se já concedida, reafirma o token no
// backend (mantém a device_tokens fresca) e considera "inscrito".
export async function nativeInit(): Promise<{ permission: PermState; subscribed: boolean }> {
  if (!isNativePlatform()) return { permission: 'unsupported', subscribed: false };
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    const permission = mapPerm(receive);
    if (permission !== 'granted') return { permission, subscribed: false };
    const subscribed = await ensureTokenRegistered();
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
    const { receive } = await FirebaseMessaging.requestPermissions();
    const permission = mapPerm(receive);
    if (permission !== 'granted') return { ok: false, permission };
    const ok = await ensureTokenRegistered();
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
    await FirebaseMessaging.deleteToken();
    return true;
  } catch (err) {
    console.error('[nativePush] unregister falhou:', err);
    return false;
  }
}
