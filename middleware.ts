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
  const isPublicPage = pathname === '/termos' || pathname === '/privacidade';
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

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
    if (!pathname.startsWith('/auth/nova-senha')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  if (user) {
    const onboardingCompleted = user.user_metadata?.onboarding_completed === true;

    if (isOnboarding && onboardingCompleted) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (!isOnboarding && !isAuthRoute && !isPublicPage && !onboardingCompleted && !isAdminRoute) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    if (pathname.startsWith('/admin') && !pathname.startsWith('/api/')) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!serviceRoleKey || !supabaseUrl) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/admins?user_id=eq.${user.id}&select=id&limit=1`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          }
        );
        const rows = await res.json() as unknown[];
        if (!Array.isArray(rows) || rows.length === 0) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      } catch {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
