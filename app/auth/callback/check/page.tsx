'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Página client-side intermediária do callback.
//
// O Supabase, quando o link expira/já foi usado, devolve o erro no
// FRAGMENT da URL (#error=access_denied&error_code=otp_expired&
// error_description=...). O servidor (route handler) não enxerga
// fragment, então o callback delega pra cá: aqui sim conseguimos ler
// window.location.hash e rotear corretamente.
//
// Chegar nesta página já significa link inválido/expirado — no fluxo
// PKCE o sucesso sempre traz ?code= e nem passa por aqui. Nunca
// mostramos a mensagem técnica do Supabase ao usuário.

function CallbackCheck() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const nextParam = searchParams.get('next');
    const isRecovery =
      nextParam != null && nextParam.startsWith('/auth/nova-senha');

    // Erro pode estar no fragment (só acessível no client)...
    const hashParams = new URLSearchParams(
      typeof window !== 'undefined'
        ? window.location.hash.replace(/^#/, '')
        : '',
    );
    // ...ou na query (defensivo, caso algo escape do servidor).
    const hasError =
      hashParams.has('error') ||
      hashParams.has('error_code') ||
      hashParams.has('error_description') ||
      searchParams.has('error') ||
      searchParams.has('error_code') ||
      searchParams.has('error_description');

    // Independente de ter marcador de erro explícito, sem code não há
    // fluxo normal a seguir — manda pro destino amigável correto.
    void hasError;
    if (isRecovery) {
      router.replace('/auth/login?error=link_invalido');
    } else {
      router.replace('/auth/confirmado?status=erro');
    }
  }, [router, searchParams]);

  return (
    <main
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-3)' }}>
        Verificando…
      </p>
    </main>
  );
}

export default function CallbackCheckPage() {
  return (
    <Suspense>
      <CallbackCheck />
    </Suspense>
  );
}
