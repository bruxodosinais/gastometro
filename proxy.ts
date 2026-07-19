import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isNetworkErrorMessage } from './lib/errors';
import { createAdminClient } from './lib/supabase/admin';
import { preflight, withCors } from './lib/cors';

// Rotas /api chamadas pelo app NATIVO (Capacitor) — fetch cross-origin que
// autentica por Authorization: Bearer (não por cookie). Pra elas o middleware
// (a) responde ao preflight OPTIONS, (b) NÃO redireciona pra /auth/login quando
// falta cookie (a própria rota resolve auth via getRequestUser cookie/Bearer) e
// (c) ecoa os headers de CORS. Na web essas chamadas são same-origin (CORS nem
// se aplica) e o usuário logado segue passando igual a antes.
const NATIVE_API = new Set<string>([
  '/api/assistente',
  '/api/categorizar-csv',
  '/api/coupons/redeem',
  '/api/delete-account',
  '/api/export-my-data',
  '/api/feedback',
  '/api/missao/gerar-desafio',
  '/api/reports/weekly-summary',
  '/api/subscription/sync',
  '/api/suporte',
  '/api/activate-beta',
]);

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/auth');
  const isOnboarding = pathname === '/onboarding';
  const isPublicPage =
    pathname === '/' ||
    pathname === '/comecar' ||
    pathname === '/inicio' ||
    pathname === '/termos' ||
    pathname === '/privacidade' ||
    pathname === '/excluir-conta' ||
    pathname === '/suporte' ||
    pathname === '/instalar';
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isPublicWebhook = pathname.startsWith('/api/webhooks/');
  // Endpoints chamados pelo cron do Vercel: autenticados via Bearer CRON_SECRET na própria rota.
  // Nota: /api/reports/weekly-summary (rota do popup do app) é autenticada por
  // sessão, então NÃO entra aqui — só o cron de push /api/push/cron/weekly-summary.
  const isCronEndpoint =
    pathname === '/api/reports/weekly' ||
    pathname === '/api/reports/monthly' ||
    pathname === '/api/push/cron/due-tomorrow' ||
    pathname === '/api/push/cron/budget-exceeded' ||
    pathname === '/api/push/cron/weekly-summary' ||
    pathname === '/api/cron/missao-lembrete' ||
    pathname === '/api/cron/email-funnel';

  if (isPublicWebhook || isCronEndpoint) {
    return supabaseResponse;
  }

  // API nativa: preflight CORS não tem cookie nem precisa de auth → responde já.
  const isNativeApi = NATIVE_API.has(pathname);
  if (isNativeApi && request.method === 'OPTIONS') {
    return preflight(request);
  }

  // /cartoes/<id> (rota dinâmica antiga) → /cartoes/detalhe?id=<id> (308
  // permanente). A rota [id] foi removida (incompatível com export estático);
  // este redirect preserva links/bookmarks antigos na web.
  const cartaoLegacy = pathname.match(/^\/cartoes\/([^/]+)\/?$/);
  if (cartaoLegacy && cartaoLegacy[1] !== 'detalhe') {
    const url = request.nextUrl.clone();
    url.pathname = '/cartoes/detalhe';
    url.searchParams.set('id', cartaoLegacy[1]);
    return NextResponse.redirect(url, 308);
  }

  let user = null;
  let isNetworkFailure = false;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isNetworkErrorMessage(error)) {
        isNetworkFailure = true;
      }
    } else {
      user = data.user;
    }
  } catch (err) {
    if (isNetworkErrorMessage(err)) {
      isNetworkFailure = true;
    }
  }

  if (isNetworkFailure) {
    return supabaseResponse;
  }

  if (!user && !isAuthRoute && !isPublicPage) {
    // API nativa: não redireciona — a rota responde 401 (com CORS) e o cliente
    // nativo trata. (Na web, essas rotas só são chamadas logado.)
    if (isNativeApi) {
      return withCors(supabaseResponse, request);
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (user && isAuthRoute) {
    // /auth/nova-senha: usuário logado via link de recuperação precisa
    // ver o form. /auth/confirmado: após confirmar o e-mail o usuário já
    // está autenticado e precisa ver a tela de sucesso (P1) em vez de ser
    // jogado direto pra home. /auth/callback: é handler transitório que
    // decide o próprio destino — se um usuário logado clica num link de
    // confirmação expirado, ele NÃO pode ser jogado pra / (e daí pra
    // /onboarding); o callback precisa rodar e mandar pra /auth/confirmado.
    if (
      !pathname.startsWith('/auth/nova-senha') &&
      !pathname.startsWith('/auth/confirmado') &&
      !pathname.startsWith('/auth/callback')
    ) {
      return NextResponse.redirect(new URL('/app', request.url));
    }
  }

  if (user) {
    const onboardingCompleted = user.user_metadata?.onboarding_completed === true;

    if (isOnboarding && onboardingCompleted) {
      return NextResponse.redirect(new URL('/app', request.url));
    }

    if (!isOnboarding && !isAuthRoute && !isPublicPage && !onboardingCompleted && !isAdminRoute && !isNativeApi) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    if (pathname.startsWith('/admin') && !pathname.startsWith('/api/')) {
      try {
        const adminClient = createAdminClient();
        const { data, error } = await adminClient
          .from('admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error || !data) {
          return NextResponse.redirect(new URL('/app', request.url));
        }
      } catch {
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }
  }

  // API nativa: ecoa CORS na resposta que segue pra rota (a rota faz a auth).
  if (isNativeApi) {
    return withCors(supabaseResponse, request);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
