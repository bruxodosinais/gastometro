/// <reference lib="webworker" />
/* TôOrganizado — Service Worker (Serwist + Web Push)
   Source compilado para public/sw.js pelo @serwist/next durante next build. */

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// SKIP_WAITING manual: o ServiceWorkerRegister no cliente envia esta mensagem
// quando o usuário clica "Atualizar" no banner de nova versão.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Web Push (migrado integralmente de public/sw.js) ─────────────────────
self.addEventListener("push", (event) => {
  let data: { title?: string; message?: string; url?: string } = {};
  try {
    data = event.data ? (event.data.json() as typeof data) : {};
  } catch {
    data = { title: "TôOrganizado", message: event.data ? event.data.text() : "" };
  }
  const title = data.title || "TôOrganizado";
  const options: NotificationOptions = {
    body: data.message || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }
            return;
          }
        } catch {
          /* ignora URLs inválidas */
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
