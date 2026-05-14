import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const ref = searchParams.get('ref');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=link_invalido`);
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
    return NextResponse.redirect(`${origin}/auth/login?error=link_invalido`);
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

  return NextResponse.redirect(`${origin}${next}`);
}
