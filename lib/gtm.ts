// Google Tag Manager + Consent Mode v2.
//
// O contêiner é carregado no layout raiz — só no build WEB (ver app/layout.tsx)
// e sempre em modo NEGADO: CONSENT_BOOTSTRAP roda como `beforeInteractive`
// (injetado no <head>, antes de qualquer módulo do Next e antes do gtm.js) e
// nega todos os storages. Nenhum cookie de analytics/ads é gravado até o usuário
// aceitar no CookieBanner, que chama updateGtmConsent() → gtag('consent','update').
//
// Sem esse par (default negado ANTES do contêiner + update depois), o Consent
// Mode não vale nada: as tags disparariam com storage liberado no primeiro hit.

export const GTM_ID = 'GTM-NR5B2B6H';

/** Chave do localStorage onde o CookieBanner guarda a decisão. */
export const CONSENT_STORAGE_KEY = 'cookie_consent';

/** Os 4 tipos de consentimento que o Consent Mode v2 exige declarar. */
const CONSENT_TYPES = [
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
  'analytics_storage',
] as const;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Script inline do bootstrap de consentimento. Nega tudo por padrão e, se o
 * visitante JÁ tinha aceito numa visita anterior, libera na hora — assim quem
 * consentiu não é medido como "denied" a cada page load.
 *
 * `wait_for_update: 500` dá meio segundo pro update chegar antes das tags
 * dispararem, evitando hit com consentimento errado em conexões lentas.
 */
export const CONSENT_BOOTSTRAP = `
(function(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  window.gtag('consent','default',{${CONSENT_TYPES.map((t) => `${t}:'denied'`).join(',')},wait_for_update:500});
  try {
    var raw = window.localStorage.getItem('${CONSENT_STORAGE_KEY}');
    if (raw && JSON.parse(raw).analytics === true) {
      window.gtag('consent','update',{${CONSENT_TYPES.map((t) => `${t}:'granted'`).join(',')}});
    }
  } catch(e) {}
})();
`;

/**
 * Avisa o GTM da decisão do usuário. Chamado pelo CookieBanner nos dois botões
 * (aceitar libera, "só essenciais" mantém negado de forma explícita).
 *
 * `accepted` vem do botão "Aceitar todos" → libera analytics E ads juntos. Se um
 * dia o banner ganhar toggles separados, quebrar em dois parâmetros aqui.
 */
export function updateGtmConsent(accepted: boolean): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const value = accepted ? 'granted' : 'denied';
  window.gtag('consent', 'update', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
}
