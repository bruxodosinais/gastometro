'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// P1: página dedicada pós-clique no link de confirmação de e-mail.
// O callback (app/auth/callback/route.ts) redireciona pra cá com
// ?status=sucesso ou ?status=erro. NUNCA recebemos/exibimos a mensagem
// técnica do Supabase — só um estado amigável.

function ConfirmadoContent() {
  const searchParams = useSearchParams();
  const sucesso = searchParams.get('status') === 'sucesso';

  return (
    <main
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 16px 40px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '390px', paddingTop: '64px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '38px',
              margin: '0 auto 16px',
            }}
          >
            {sucesso ? '✅' : '✉️'}
          </div>
          <h1
            style={{
              fontWeight: 900,
              fontSize: '28px',
              letterSpacing: '-0.03em',
              margin: '0 0 6px',
              color: 'var(--text)',
            }}
          >
            Tô<span style={{ color: 'var(--accent)' }}>Organizado</span>
          </h1>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: '20px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          {sucesso ? (
            <>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '0 0 8px',
                }}
              >
                E-mail confirmado!
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-3)',
                  lineHeight: 1.6,
                  margin: '0 0 20px',
                }}
              >
                Sua conta está ativa.
              </p>
              <Link
                href="/"
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow:
                    '0 4px 20px rgba(91,91,214,0.38), 0 1px 4px rgba(91,91,214,0.2)',
                }}
              >
                Entrar agora
              </Link>
            </>
          ) : (
            <>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '0 0 8px',
                }}
              >
                Link já utilizado
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-3)',
                  lineHeight: 1.6,
                  margin: '0 0 20px',
                }}
              >
                Este link já foi usado ou expirou. Isso é normal — sua conta
                pode já estar ativa. Tente entrar normalmente.
              </p>
              <Link
                href="/auth/login"
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow:
                    '0 4px 20px rgba(91,91,214,0.38), 0 1px 4px rgba(91,91,214,0.2)',
                  marginBottom: '10px',
                }}
              >
                Entrar
              </Link>
              <Link
                href="/auth/confirmar-email"
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'var(--surface)',
                  color: 'var(--text-2)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Reenviar e-mail de confirmação
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ConfirmadoPage() {
  return (
    <Suspense>
      <ConfirmadoContent />
    </Suspense>
  );
}
