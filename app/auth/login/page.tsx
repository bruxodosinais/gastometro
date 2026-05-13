'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function traduzirErroAuth(mensagem: string): string {
  if (mensagem.includes('Email not confirmed'))
    return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
  if (mensagem.includes('Invalid login credentials'))
    return 'E-mail ou senha incorretos.';
  if (mensagem.includes('User already registered'))
    return 'Este e-mail já está cadastrado.';
  if (mensagem.includes('Password should be at least 6 characters'))
    return 'A senha deve ter no mínimo 6 caracteres.';
  return 'E-mail ou senha incorretos.';
}

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 7.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M1.5 9s3-5.25 7.5-5.25S16.5 9 16.5 9s-3 5.25-7.5 5.25S1.5 9 1.5 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M10.94 10.94A2.25 2.25 0 0 1 7.06 7.06M1.5 1.5l15 15M7.64 3.87A8.37 8.37 0 0 1 9 3.75c4.5 0 7.5 5.25 7.5 5.25a14.94 14.94 0 0 1-2.01 2.81M6.3 6.3A14.94 14.94 0 0 0 1.5 9s3 5.25 7.5 5.25a8.37 8.37 0 0 0 3.95-.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 800,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
  marginBottom: '7px',
};

const ICON_WRAP: React.CSSProperties = {
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--text-3)',
  display: 'flex',
  pointerEvents: 'none',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const deleted = searchParams.get('deleted') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    urlError === 'link_invalido' ? 'O link é inválido ou expirou. Solicite um novo.' : ''
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(traduzirErroAuth(authError.message));
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  const isDisabled = loading || !email || !password;

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
            Finalmente, tô organizado.
          </p>
        </div>

        {deleted && (
          <p
            style={{
              fontSize: '14px',
              textAlign: 'center',
              color: 'var(--green-text)',
              background: 'var(--green-bg)',
              borderRadius: '12px',
              padding: '10px 16px',
              marginBottom: '16px',
            }}
          >
            Conta excluída com sucesso.
          </p>
        )}

        {/* Form */}
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* E-mail */}
          <div>
            <label style={LABEL}>E-mail</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className={`auth-input${error ? ' field-error' : ''}`}
              />
              <span style={ICON_WRAP}>
                <EnvelopeIcon />
              </span>
            </div>
          </div>

          {/* Senha */}
          <div>
            <label style={LABEL}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className={`auth-input${error ? ' field-error' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-3)',
                  display: 'flex',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: '6px' }}>
              <Link
                href="/auth/recuperar-senha"
                style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}
              >
                Esqueci minha senha
              </Link>
            </div>
          </div>

          {/* Erro */}
          {error && (
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
              {error}
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
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-2)',
            marginTop: '20px',
          }}
        >
          Não tem conta?{' '}
          <Link
            href="/auth/cadastro"
            style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}
          >
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
