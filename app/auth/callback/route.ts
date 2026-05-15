import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const next = nextParam ?? '/';
  const ref = searchParams.get('ref');

  // Confirmação de cadastro não passa `next` (recuperação de senha usa
  // ?next=/auth/nova-senha). Só o fluxo de cadastro cai na página amigável
  // /auth/confirmado; o de senha mantém o comportamento antigo.
  const isSignupConfirmation = nextParam == null;
  const errorRedirect = isSignupConfirmation
    ? `${origin}/auth/confirmado?status=erro`
    : `${origin}/auth/login?error=link_invalido`;

  // Fluxo PKCE: o Supabase pode devolver o erro como query
  // (?error=access_denied&error_code=otp_expired&error_description=...).
  const hasErrorParam =
    searchParams.has('error') ||
    searchParams.has('error_code') ||
    searchParams.has('error_description');

  if (hasErrorParam) {
    return NextResponse.redirect(errorRedirect);
  }

  if (!code) {
    // Sem code e sem erro na query: o erro provavelmente está no fragment
    // (#error=access_denied&error_code=otp_expired&...), que o servidor
    // NÃO enxerga. Delega pra uma página client que lê window.location.hash
    // e roteia corretamente. O browser preserva o fragment neste redirect
    // (o destino não tem fragment próprio).
    const checkUrl = new URL('/auth/callback/check', origin);
    if (nextParam != null) checkUrl.searchParams.set('next', nextParam);
    return NextResponse.redirect(checkUrl);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // Supabase às vezes strippa query da redirect URL, então o ref também
  // vai pelo user_metadata (setado no signUp).
  const metadataRef = (data?.user?.user_metadata as Record<string, unknown> | undefined)?.signup_ref;
  const effectiveRef = ref ?? (typeof metadataRef === 'string' ? metadataRef : null);

  console.log(
    '[callback] urlRef:', ref,
    'metaRef:', metadataRef,
    'userId:', data?.user?.id,
    'error:', error?.message,
  );

  if (error) {
    return NextResponse.redirect(errorRedirect);
  }

  if (effectiveRef === 'beta' && data.user?.id) {
    try {
      const admin = createAdminClient();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: grantError } = await admin
        .from('subscriptions')
        .upsert(
          {
            user_id: data.user.id,
            plan: 'pro',
            status: 'active',
            billing_cycle: 'beta',
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      console.log('[callback] grant beta result:', grantError?.message ?? 'ok', 'until:', periodEnd);
    } catch (err) {
      console.error('[callback] grant beta exception:', err);
    }
  }

  return NextResponse.redirect(
    isSignupConfirmation
      ? `${origin}/auth/confirmado?status=sucesso`
      : `${origin}${next}`,
  );
}
