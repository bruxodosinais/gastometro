'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import LoadingButton from '@/components/ui/LoadingButton';

// Recuperação de senha por CÓDIGO (não por link), em AMBAS as plataformas.
// Dois motivos, os mesmos que já levaram o cadastro a virar só-código:
// 1) PKCE: o resetPasswordForEmail guarda o code_verifier no cliente que PEDIU o
//    reset. No nativo esse cliente é o WKWebView (localStorage do Capacitor) e o
//    link do e-mail abre no Safari → o verifier não está lá e o exchange falha
//    sempre. Na web falha igual se o e-mail for aberto em outro navegador.
// 2) Scanners de e-mail pré-buscam o link e consomem o token de uso único
//    (foi a rejeição Apple 2.1a no cadastro).
// verifyOtp(type:'recovery') cria a sessão no client e leva pra /auth/nova-senha,
// que só chama updateUser — serve na web (cookies) e no nativo (localStorage).

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

const MSG_ERRO: React.CSSProperties = {
  fontSize: '13px',
  textAlign: 'center',
  color: 'var(--red)',
  background: 'var(--red-bg)',
  borderRadius: '12px',
  padding: '10px 16px',
  margin: 0,
};

const MSG_INFO: React.CSSProperties = {
  fontSize: '13px',
  textAlign: 'center',
  color: 'var(--green-text)',
  background: 'var(--green-bg)',
  borderRadius: '12px',
  padding: '10px 16px',
  margin: 0,
};

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 7.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RecuperarSenhaPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Etapa 1: dispara o e-mail com o código. O redirectTo fica por compatibilidade
  // (é inofensivo num template só-código e ainda serve a links antigos na caixa).
  async function handleEnviarEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setInfo('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/auth/nova-senha`,
    });

    if (error) {
      setErro('Não foi possível enviar o e-mail. Tente novamente.');
    } else {
      setEtapa('codigo');
      setCountdown(COOLDOWN_SEGUNDOS);
    }
    setLoading(false);
  }

  // Etapa 2: valida o código. Em sucesso a sessão nasce no client e o
  // /auth/nova-senha consegue chamar updateUser({ password }).
  async function handleConfirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErro('');
    setInfo('');

    const token = code.replace(/\D/g, '');
    if (token.length < 6) {
      setErro('Digite o código enviado pro seu e-mail.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('expired')) {
        setErro('Código expirado. Toque em "Reenviar código" pra receber um novo.');
      } else if (msg.includes('invalid') || msg.includes('token')) {
        setErro('Código inválido. Confira os dígitos e tente de novo.');
      } else {
        setErro('Não foi possível validar o código. Tente novamente.');
      }
      setLoading(false);
      return;
    }

    router.push('/auth/nova-senha');
  }

  async function handleReenviar() {
    if (!email || resending || countdown > 0) return;
    setErro('');
    setInfo('');
    setResending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/auth/nova-senha`,
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('rate') || msg.includes('seconds')) {
        setErro('Aguarde alguns segundos antes de reenviar.');
      } else {
        setErro('Erro ao reenviar. Tente novamente em alguns minutos.');
      }
    } else {
      setInfo('Código reenviado. Confira sua caixa de entrada e spam.');
    }
    setCountdown(COOLDOWN_SEGUNDOS);
    setResending(false);
  }

  function voltarParaEmail() {
    setEtapa('email');
    setCode('');
    setErro('');
    setInfo('');
  }

  const emailDisabled = loading || !email;
  const codigoDisabled = loading || code.replace(/\D/g, '').length < 6;

  return (
    <main
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'env(safe-area-inset-top) 16px calc(40px + env(safe-area-inset-bottom))',
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
            {etapa === 'email' ? 'Vamos recuperar sua conta' : 'Digite o código'}
          </p>
        </div>

        {etapa === 'codigo' ? (
          <>
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
              <strong style={{ color: 'var(--text-1)' }}>{email}</strong>. Digite-o abaixo pra
              criar uma nova senha.
            </p>

            <form
              className="auth-form"
              onSubmit={handleConfirmarCodigo}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <label style={LABEL}>Código de recuperação</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000000"
                  maxLength={8}
                  className={`auth-input${erro ? ' field-error' : ''}`}
                  style={{
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: 800,
                    letterSpacing: '0.22em',
                  }}
                />
              </div>

              {erro && <p style={MSG_ERRO}>{erro}</p>}
              {info && <p style={MSG_INFO}>{info}</p>}

              <LoadingButton
                type="submit"
                disabled={codigoDisabled}
                loading={loading}
                loadingText="Validando..."
                spinnerColor="#8888CC"
                className="auth-btn"
                style={{
                  background: codigoDisabled ? '#D1D1F0' : 'var(--accent)',
                  color: codigoDisabled ? '#8888CC' : '#ffffff',
                  boxShadow: codigoDisabled
                    ? 'none'
                    : '0 4px 20px rgba(91,91,214,0.38), 0 1px 4px rgba(91,91,214,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                Continuar
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
              <button
                type="button"
                onClick={voltarParaEmail}
                style={{
                  color: 'var(--accent)',
                  fontWeight: 800,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              >
                ← Usar outro e-mail
              </button>
            </p>
          </>
        ) : (
          <>
            <form
              className="auth-form"
              onSubmit={handleEnviarEmail}
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
              {erro && <p style={MSG_ERRO}>{erro}</p>}

              {/* Botão */}
              <LoadingButton
                type="submit"
                disabled={emailDisabled}
                loading={loading}
                loadingText="Enviando..."
                spinnerColor="#8888CC"
                className="auth-btn"
                style={{
                  background: emailDisabled ? '#D1D1F0' : 'var(--accent)',
                  color: emailDisabled ? '#8888CC' : '#ffffff',
                  boxShadow: emailDisabled
                    ? 'none'
                    : '0 4px 20px rgba(91,91,214,0.38), 0 1px 4px rgba(91,91,214,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                Enviar código de recuperação
              </LoadingButton>
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
