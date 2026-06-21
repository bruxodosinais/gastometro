import { NextResponse } from 'next/server';

// Origins permitidas a chamar as /api cross-origin. SEM wildcard.
// - Nativo (Capacitor): CONFIRMADAS em produção pelo feedback funcionando —
//   iOS = capacitor://localhost, Android = https://localhost.
// - Web: as chamadas são same-origin (path relativo) → CORS nem se aplica;
//   os hosts web entram por completude.
const ALLOWED_ORIGINS = new Set<string>([
  'capacitor://localhost',
  'https://localhost',
  'https://www.toorganizado.com.br',
  'https://toorganizado.com.br',
]);

const ALLOW_METHODS = 'GET, POST, DELETE, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Authorization';

// Origins do webview nativo (Capacitor). Subconjunto da allowlist.
const NATIVE_ORIGINS = new Set<string>(['capacitor://localhost', 'https://localhost']);

// Request veio do app NATIVO? (pelo Origin do webview). Usado pelo Pro-gate das
// rotas: no nativo o Pro é liberado de graça (v1 free nas lojas). NOTA: o Origin
// só não é forjável por um browser; um cliente fora-do-browser poderia mandar
// esse header. Risco aceito no v1 (free, sem dinheiro real).
export function isNativeRequest(req: Request): boolean {
  const origin = req.headers.get('origin');
  return origin !== null && NATIVE_ORIGINS.has(origin);
}

// Headers de CORS para uma origin. Só ecoa Allow-Origin se a origin estiver na
// allowlist (eco exato — requisito de não-wildcard). Sem credentials: o nativo
// autentica por Bearer (não por cookie), então não precisamos de cookies
// cross-origin.
export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// Resposta ao preflight OPTIONS.
export function preflight(req: Request): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

// Aplica os headers de CORS a uma resposta já montada (passa o Origin da req).
export function withCors(res: NextResponse, req: Request): NextResponse {
  const h = corsHeaders(req.headers.get('origin'));
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  return res;
}
