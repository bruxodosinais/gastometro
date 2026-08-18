'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CONSENT_STORAGE_KEY, updateGtmConsent } from '@/lib/gtm';

const STORAGE_KEY = CONSENT_STORAGE_KEY;

export type CookieConsent = {
  essential: true;
  analytics: boolean;
  ts: number;
};

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (parsed && typeof parsed.analytics === 'boolean' && typeof parsed.ts === 'number') {
      return { essential: true, analytics: parsed.analytics, ts: parsed.ts };
    }
    return null;
  } catch {
    return null;
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getCookieConsent() === null) setVisible(true);
  }, []);

  const save = (analytics: boolean) => {
    const payload: CookieConsent = { essential: true, analytics, ts: Date.now() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors (private mode etc.)
    }
    // Libera (ou nega explicitamente) as tags do GTM. Sem isso o contêiner ficaria
    // preso no default negado do bootstrap até o próximo page load.
    updateGtmConsent(analytics);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-lg border-t border-[#e5e7eb] p-4"
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-3">
        <p className="text-sm text-slate-700">
          Usamos cookies essenciais para o funcionamento do site e, com sua autorização, cookies
          analíticos e de publicidade — para medir resultados e melhorar nossas campanhas. Saiba
          mais na nossa{' '}
          <Link href="/privacidade" className="text-indigo-600 underline">
            Política de Privacidade
          </Link>
          .
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            className="flex-1 border border-indigo-600 text-indigo-600 rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-50"
          >
            Só essenciais
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            className="flex-1 bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
