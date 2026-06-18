'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isNativePlatform } from '@/lib/native';

// Gate de auth client-side ATIVO SÓ NO NATIVO (Capacitor). No webview não há
// middleware (proxy.ts não roda em export estático), então o gating vive aqui.
// Na WEB é NO-OP: retorna cedo e o proxy.ts segue como único gate → zero
// mudança de comportamento na web.
//
// Replica os gates do proxy.ts que dependem só da sessão (login + onboarding).
// O gate de admin NÃO entra aqui: depende da service role (server-only) e o
// /admin não é embarcado no app nativo — segue exclusivamente no proxy (web).
export default function AuthGate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isNativePlatform()) return; // web → middleware é o gate
    let cancelled = false;
    (async () => {
      const { data } = await createClient().auth.getUser();
      if (cancelled) return;
      const user = data.user;
      if (!user) {
        router.replace('/auth/login');
        return;
      }
      const onboardingDone = user.user_metadata?.onboarding_completed === true;
      if (!onboardingDone && pathname !== '/onboarding') {
        router.replace('/onboarding');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
