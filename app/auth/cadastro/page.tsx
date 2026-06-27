'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { readLocalPresignup } from '@/lib/onboarding/presignupMission';
import { fetchApi } from '@/lib/fetchApi';
import { isNativePlatform } from '@/lib/native';
import LoadingButton from '@/components/ui/LoadingButton';

function maskBrazilPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function traduzirErroAuth(mensagem: string): string {
  if (mensagem.includes('User already registered'))
    return 'Este e-mail já está cadastrado. Faça login ou use "Esqueci minha senha".';
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
  const [whatsapp, setWhatsapp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Prefill aditivo (nativo): se o quiz salvou um nome no presignup, pré-preenche
  // o Nome. Effect pós-mount p/ não dar hydration mismatch no export estático.
  // Web: presignup do /comecar não tem userFirstName → no-op (mantém vazio).
  useEffect(() => {
    const first = readLocalPresignup()?.userFirstName;
    if (first) setName((prev) => prev || first);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (!termsAccepted) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const ref = searchParams.get('ref');
    const redirectTo = `${getSiteUrl()}/auth/callback${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
    // Missão capturada no /comecar (durabilidade cross-device via user_metadata).
    const presignupMission = readLocalPresignup();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: name.trim(),
          ...(ref ? { signup_ref: ref } : {}),
          ...(presignupMission ? { presignup_mission: presignupMission } : {}),
        },
      },
    });

    if (authError) {
      setError(traduzirErroAuth(authError.message));
      setLoading(false);
      return;
    }

    // E-mail já cadastrado COM a proteção anti-enumeração ligada: o signUp não
    // dá erro — devolve um user "fantasma" (identities vazio) e session null, sem
    // mandar OTP. Sem este guard, o usuário cairia no confirmar-codigo/email
    // esperando um código que nunca chega. Detecção canônica do Supabase:
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('Este e-mail já está cadastrado. Faça login ou use "Esqueci minha senha".');
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

      const digits = whatsapp.replace(/\D/g, '');
      if (digits.length >= 10) {
        await supabase.from('profiles').upsert({
          id: userId,
          whatsapp_phone: `55${digits}`,
          updated_at: new Date().toISOString(),
        });
      }

      if (ref === 'beta') {
        // Plano Pro do beta: o insert precisa da service role (RLS não deixa
        // o próprio usuário escrever em subscriptions). Feito server-side,
        // logo após o signUp, pra não depender só do callback de confirmação
        // de e-mail — que não roda quando o signUp já devolve sessão.
        try {
          await fetchApi('/api/activate-beta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
        } catch {
          // Best-effort: o callback de confirmação de e-mail é o fallback.
        }
      } else {
        await supabase.from('subscriptions').upsert(
          { user_id: userId, plan: 'free', status: 'active' },
          { onConflict: 'user_id' },
        );
      }
    }

    if (data.session) {
      router.push('/app');
      router.refresh();
      return;
    }

    localStorage.setItem('pending_confirmation_email', email);
    // NATIVO: o link de confirmação abriria no navegador e não logaria o
    // webview → confirma por CÓDIGO (OTP). WEB: segue pelo link, idêntico.
    if (isNativePlatform()) {
      router.push(`/auth/confirmar-codigo?email=${encodeURIComponent(email)}`);
      return;
    }
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

          {/* WhatsApp (opcional) */}
          <div>
            <label style={LABEL}>WhatsApp (opcional)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                inputMode="numeric"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskBrazilPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                className="auth-input"
              />
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
                placeholder="Mínimo 8 caracteres"
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
          <LoadingButton
            type="submit"
            disabled={isDisabled}
            loading={loading}
            loadingText="Criando conta..."
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
            Criar conta
          </LoadingButton>
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
