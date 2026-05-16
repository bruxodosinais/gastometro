'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function traduzirErroAuth(mensagem: string): string {
  if (mensagem.includes('User already registered'))
    return 'Este e-mail já está cadastrado.';
  if (mensagem.includes('Password should be at least 6 characters'))
    return 'A senha deve ter no mínimo 6 caracteres.';
  return mensagem;
}

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 7.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 15c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

const EYE_BTN: React.CSSProperties = {
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
};

function CadastroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (!termsAccepted) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const ref = searchParams.get('ref');
    const redirectTo = `${location.origin}/auth/callback${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: name.trim(),
          ...(ref ? { signup_ref: ref } : {}),
        },
      },
    });

    if (authError) {
      setError(traduzirErroAuth(authError.message));
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      await supabase.from('profiles').upsert({
        id: userId,
        terms_accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await supabase.from('subscriptions').upsert(
        { user_id: userId, plan: 'free', status: 'active' },
        { onConflict: 'user_id' },
      );
    }

    if (data.session) {
      router.push('/');
      router.refresh();
      return;
    }

    localStorage.setItem('pending_confirmation_email', email);
    router.push(`/auth/confirmar-email?email=${encodeURIComponent(email)}`);
  }

  const isDisabled = loading || !termsAccepted || !name || !email || !password || !confirm;

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-vertical.png"
            alt="TôOrganizado"
            style={{ width: '132px', height: 'auto', display: 'block', margin: '0 auto 16px' }}
          />
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-3)', margin: 0 }}>
            Crie sua conta gratuita
          </p>
        </div>

        {/* Form */}
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {/* Nome */}
          <div>
            <label style={LABEL}>Nome</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu primeiro nome"
                required
                autoComplete="given-name"
                className="auth-input"
              />
              <span style={ICON_WRAP}>
                <PersonIcon />
              </span>
            </div>
          </div>

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
                className="auth-input"
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
                placeholder="Mínimo 6 caracteres"
                required
                autoComplete="new-password"
                className="auth-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={EYE_BTN}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirmar senha */}
          <div>
            <label style={LABEL}>Confirmar senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="auth-input"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                style={EYE_BTN}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          {/* Checkbox termos */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <div
              style={{
                width: '20px',
                height: '20px',
                flexShrink: 0,
                marginTop: '1px',
                background: termsAccepted ? 'var(--accent)' : 'var(--surface)',
                border: `1.5px solid ${termsAccepted ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {termsAccepted && (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                  <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', lineHeight: '1.6' }}>
              Li e aceito os{' '}
              <Link
                href="/termos"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
              >
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
              >
                Política de Privacidade
              </Link>
            </span>
          </label>

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
            {loading ? 'Criando conta...' : 'Criar conta'}
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
          Já tem conta?{' '}
          <Link
            href="/auth/login"
            style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroContent />
    </Suspense>
  );
}
