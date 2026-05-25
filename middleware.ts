import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isNetworkErrorMessage } from './lib/errors';

export default async function middleware(request: NextRequest) {
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
    pathname === '/' || pathname === '/termos' || pathname === '/privacidade';
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
    pathname === '/api/push/cron/weekly-summary';

  if (isPublicWebhook || isCronEndpoint) {
    return supabaseResponse;
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

    if (!isOnboarding && !isAuthRoute && !isPublicPage && !onboardingCompleted && !isAdminRoute) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    if (pathname.startsWith('/admin') && !pathname.startsWith('/api/')) {
      console.log('[ADMIN DEBUG] Verificando acesso admin para user:', user.id);
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!serviceRoleKey || !supabaseUrl) {
        console.log('[ADMIN DEBUG] REDIRECT: SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL ausente');
        return NextResponse.redirect(new URL('/app', request.url));
      }
      try {
        const fetchUrl = `${supabaseUrl}/rest/v1/admins?user_id=eq.${user.id}&select=id&limit=1`;
        console.log('[ADMIN DEBUG] Consultando:', fetchUrl);
        const res = await fetch(fetchUrl, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        });
        console.log('[ADMIN DEBUG] HTTP status da consulta:', res.status);
        const rows = await res.json() as unknown[];
        console.log('[ADMIN DEBUG] Linhas retornadas:', JSON.stringify(rows));
        if (!Array.isArray(rows) || rows.length === 0) {
          console.log('[ADMIN DEBUG] REDIRECT: usuário não encontrado na tabela admins');
          return NextResponse.redirect(new URL('/app', request.url));
        }
        console.log('[ADMIN DEBUG] Acesso liberado — usuário é admin');
      } catch (err) {
        console.log('[ADMIN DEBUG] REDIRECT: exceção ao consultar tabela admins:', err);
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
