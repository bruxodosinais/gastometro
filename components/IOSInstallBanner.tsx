'use client';

import { useEffect, useState } from 'react';
import { X, Share } from 'lucide-react';
import { isNativePlatform } from '@/lib/native';

const DISMISS_KEY = 'ios-install-dismissed';

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Quem baixou o app da loja não precisa "adicionar à tela de início" — e as 3
    // checagens abaixo passam dentro do WKWebView do Capacitor. Web: sempre false.
    if (isNativePlatform()) return;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS legacy fallback
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true';

    if (!isIOS || !isSafari || isStandalone || dismissed) return;

    setShow(true);
    const t = window.setTimeout(() => setEntered(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* localStorage indisponível (modo privado) — ignora */
    }
    setEntered(false);
    window.setTimeout(() => setShow(false), 300);
  };

  return (
    <div
      role="dialog"
      aria-label="Instalar TôOrganizado"
      className="fixed left-0 right-0 bottom-0 z-[70] px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3"
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
        transform: entered ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms ease-out',
      }}
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <img
          src="/icon-192.png"
          alt=""
          width={40}
          height={40}
          className="rounded-xl shrink-0"
          style={{ border: '1px solid #E5E7EB' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight" style={{ color: '#1A1A1A' }}>
            Instale o TôOrganizado
          </p>
          <p
            className="mt-0.5 text-xs leading-snug flex items-center gap-1 flex-wrap"
            style={{ color: '#6B6B6B' }}
          >
            Toque em
            <Share size={12} style={{ color: '#5B5BD6', display: 'inline' }} />
            e depois &ldquo;Adicionar à Tela de Início&rdquo;
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar"
          className="shrink-0 -mr-1 p-2 rounded-full"
          style={{ color: '#6B6B6B' }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
