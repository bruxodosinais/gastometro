// Ponte web ↔ nativo (Capacitor). NÃO depende de @capacitor/core (instalado só
// na Fase 2): o Capacitor injeta o global `window.Capacitor` no webview nativo;
// na web esse global não existe → isNativePlatform() retorna false.

type CapacitorGlobal = { isNativePlatform?: () => boolean };

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return typeof cap?.isNativePlatform === 'function' ? cap.isNativePlatform() : false;
}

// Base absoluta das APIs (Vercel) usada SÓ no nativo. Vazia na web.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/+$/, '');

// Resolve a URL de uma rota /api. Web: relativo (comportamento IDÊNTICO ao
// atual). Nativo: prefixa a base Vercel (o webview não tem /api local).
export function apiUrl(path: string): string {
  if (isNativePlatform() && API_BASE) return `${API_BASE}${path}`;
  return path;
}
