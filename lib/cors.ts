import { NextResponse } from 'next/server';

// Origins permitidas a chamar as /api cross-origin. SEM wildcard.
// - Web: as chamadas são same-origin (path relativo) → CORS nem se aplica;
//   incluímos os hosts web por completude/segurança.
// - Nativo (Capacitor): o webview serve de um scheme próprio →
//   iOS = capacitor://localhost (iosScheme padrão "capacitor"),
//   Android = https://localhost (androidScheme padrão "https"),
//   http://localhost cobre live-reload/dev.
// CONFIRMAR/TRAVAR via Origin logado em produção (ver logOrigin abaixo).
const ALLOWED_ORIGINS = new Set<string>([
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'https://www.toorganizado.com.br',
  'https://toorganizado.com.br',
]);

const ALLOW_METHODS = 'GET, POST, DELETE, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Authorization';

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

// TEMPORÁRIO (verificação): loga o Origin recebido pra travarmos a allowlist
// exata por plataforma. Remover após confirmar as origins.
export function logOrigin(req: Request, tag: string): void {
  const origin = req.headers.get('origin');
  if (origin) console.log(`[CORS] ${tag} Origin=${origin}`);
}
