'use client';

import { useCallback, useEffect, useState } from 'react';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface UsePushNotificationsResult {
  isSupported: boolean;
  permission: PushPermission;
  subscribed: boolean;
  loading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

async function getActiveRegistration(): Promise<ServiceWorkerRegistration> {
  // ServiceWorkerRegister (montado no app/layout.tsx) já registra /sw.js no
  // boot do app. Aqui só esperamos a registration ficar pronta e reaproveitamos.
  // Fallback: se por algum motivo nada foi registrado ainda, registramos sob demanda.
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);
    if (!supported) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        /* silencioso */
      }
    })();
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY ausente.');
      return false;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const reg = await getActiveRegistration();
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
        return false;
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: raw.endpoint,
          keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
        }),
      });
      if (!res.ok) return false;
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('[push] subscribe falhou:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator)) return false;

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!reg) {
        setSubscribed(false);
        return true;
      }
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return true;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      setSubscribed(false);
      return true;
    } catch (err) {
      console.error('[push] unsubscribe falhou:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { isSupported, permission, subscribed, loading, subscribe, unsubscribe };
}
