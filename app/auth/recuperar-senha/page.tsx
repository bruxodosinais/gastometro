'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 7.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/nova-senha`,
    });

    if (error) {
      setErro('Não foi possível enviar o e-mail. Tente novamente.');
    } else {
      setMensagem('Enviamos um link para redefinir sua senha. Verifique seu e-mail.');
    }
    setLoading(false);
  }

  const isDisabled = loading || !email;

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
      <div
        style={{
          width: '100%',
          maxWidth: '390px',
          paddingTop: '44px',
        }}
      >
        {/* Hero */}
        <div className="auth-hero" style={{ textAlign: 'center', marginBottom: '32px' }}>
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
            ✅
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
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-3)', margin: 0 }}>
            Vamos recuperar sua conta
          </p>
        </div>

        {mensagem ? (
          <div className="auth-form" style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--green-text)',
                background: 'var(--green-bg)',
                border: '1px solid var(--green)',
                borderRadius: '12px',
                padding: '12px 16px',
              }}
            >
              {mensagem}
            </p>
            <Link
              href="/auth/login"
              style={{
                display: 'inline-block',
                marginTop: '24px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              ← Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <form
              className="auth-form"
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* E-mail */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 800,
                    color: 'var(--text-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    marginBottom: '7px',
                  }}
                >
                  E-mail
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className={`auth-input${erro ? ' field-error' : ''}`}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-3)',
                      display: 'flex',
                      pointerEvents: 'none',
                    }}
                  >
                    <EnvelopeIcon />
                  </span>
                </div>
              </div>

              {/* Erro */}
              {erro && (
                <p
                  style={{
                    fontSize: '13px',
                    textAlign: 'center',
                    color: 'var(--red)',
                    background: 'var(--red-bg)',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    margin: 0,
                  }}
                >
                  {erro}
                </p>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={isDisabled}
                className="auth-btn"
                style={{
                  background: isDisabled ? '#D1D1F0' : 'var(--accent)',
                  color: isDisabled ? '#8888CC' : '#ffffff',
                  boxShadow: isDisabled
                    ? 'none'
                    : '0 4px 20px rgba(91,91,214,0.38), 0 1px 4px rgba(91,91,214,0.2)',
                }}
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>

            <p
              style={{
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-2)',
                marginTop: '20px',
              }}
            >
              <Link
                href="/auth/login"
                style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}
              >
                ← Voltar para o login
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
