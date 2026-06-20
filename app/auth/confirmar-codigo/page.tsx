'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import LoadingButton from '@/components/ui/LoadingButton';

// Tela de confirmação por CÓDIGO (OTP de 6 dígitos). Usada no app NATIVO, onde
// o link de confirmação abriria no navegador e não logaria o webview. Na WEB o
// fluxo segue pelo link (/auth/confirmar-email) — esta tela só é alcançada
// quando o cadastro detecta isNativePlatform(). Funciona em ambos mesmo assim.

const COOLDOWN_SEGUNDOS = 60;

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 800,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
  marginBottom: '7px',
};

function ConfirmarCodigoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const fromUrl = searchParams.get('email');
    if (fromUrl) {
      setEmail(fromUrl);
      return;
    }
    const fromStorage = localStorage.getItem('pending_confirmation_email');
    if (fromStorage) setEmail(fromStorage);
  }, [searchParams]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setError('');
    setInfo('');

    const token = code.replace(/\D/g, '');
    if (token.length < 6) {
      setError('Digite o código enviado pro seu e-mail.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    // type 'signup' = confirmação de cadastro. Em sucesso a sessão é criada no
    // client → o AuthGate (nativo) leva pra /onboarding, onde a missão do
    // /comecar é aplicada.
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (verifyError) {
      const msg = (verifyError.message || '').toLowerCase();
      if (msg.includes('expired')) {
        setError('Código expirado. Toque em "Reenviar código" pra receber um novo.');
      } else if (msg.includes('invalid') || msg.includes('token')) {
        setError('Código inválido. Confira os 6 dígitos e tente de novo.');
      } else {
        setError('Não foi possível confirmar. Tente novamente.');
      }
      setLoading(false);
      return;
    }

    router.replace('/onboarding');
    router.refresh();
  }

  async function handleReenviar() {
    if (!email || resending || countdown > 0) return;
    setError('');
    setInfo('');
    setResending(true);

    const supabase = createClient();
    // emailRedirectTo precisa bater com o do signUp (vale pro link da web no
    // mesmo e-mail); o código {{ .Token }} vem no mesmo template.
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${getSiteUrl()}/auth/callback` },
    });

    if (resendError) {
      const msg = (resendError.message || '').toLowerCase();
      if (msg.includes('rate') || msg.includes('seconds')) {
        setError('Aguarde alguns segundos antes de reenviar.');
      } else if (msg.includes('already') && msg.includes('confirmed')) {
        setError('Este e-mail já foi confirmado. Faça login normalmente.');
      } else {
        setError('Erro ao reenviar. Tente novamente em alguns minutos.');
      }
      setCountdown(COOLDOWN_SEGUNDOS);
    } else {
      setInfo('Código reenviado. Confira sua caixa de entrada e spam.');
      setCountdown(COOLDOWN_SEGUNDOS);
    }
    setResending(false);
  }

  const isDisabled = loading || code.replace(/\D/g, '').length < 6;

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
      <div style={{ width: '100%', maxWidth: '390px', paddingTop: '44px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-vertical.png"
            alt="TôOrganizado"
            style={{ width: '132px', height: 'auto', display: 'block', margin: '0 auto 16px' }}
          />
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-3)', margin: 0 }}>
            Confirme seu e-mail
          </p>
        </div>

        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-2)',
            textAlign: 'center',
            marginBottom: '24px',
            lineHeight: 1.5,
          }}
        >
          Enviamos um código para{' '}
          <strong style={{ color: 'var(--text-1)' }}>{email ?? 'seu e-mail'}</strong>. Digite-o
          abaixo pra ativar sua conta.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={LABEL}>Código de confirmação</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000000"
              maxLength={8}
              className={`auth-input${error ? ' field-error' : ''}`}
              style={{
                textAlign: 'center',
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '0.22em',
              }}
            />
          </div>

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
          {info && (
            <p
              style={{
                fontSize: '13px',
                textAlign: 'center',
                color: 'var(--green-text)',
                background: 'var(--green-bg)',
                borderRadius: '12px',
                padding: '10px 16px',
                margin: 0,
              }}
            >
              {info}
            </p>
          )}

          <LoadingButton
            type="submit"
            disabled={isDisabled}
            loading={loading}
            loadingText="Confirmando..."
            spinnerColor="#8888CC"
            className="auth-btn"
            style={{
              background: isDisabled ? '#D1D1F0' : 'var(--accent)',
              color: isDisabled ? '#8888CC' : '#ffffff',
              boxShadow: isDisabled
                ? 'none'
                : '0 4px 20px rgba(91,91,214,0.38), 0 1px 4px rgba(91,91,214,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            Confirmar
          </LoadingButton>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={handleReenviar}
            disabled={resending || countdown > 0}
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: countdown > 0 || resending ? 'var(--text-3)' : 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: countdown > 0 || resending ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            {resending
              ? 'Reenviando...'
              : countdown > 0
                ? `Reenviar código em ${countdown}s`
                : 'Reenviar código'}
          </button>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-2)',
            marginTop: '20px',
          }}
        >
          <Link href="/auth/login" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>
            ← Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ConfirmarCodigoPage() {
  return (
    <Suspense>
      <ConfirmarCodigoContent />
    </Suspense>
  );
}
