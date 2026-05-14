'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const COOLDOWN_SEGUNDOS = 60;

function ConfirmarEmailContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
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

  async function handleReenviar() {
    if (!email || loading || countdown > 0) return;
    setMensagem('');
    setErro('');
    setLoading(true);

    const supabase = createClient();
    // emailRedirectTo precisa bater com o usado no signUp original, senão o
    // link cai em hostname inválido e a confirmação não chega/quebra.
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('rate') || msg.includes('seconds')) {
        setErro('Aguarde alguns segundos antes de tentar reenviar novamente.');
      } else if (msg.includes('already') && msg.includes('confirmed')) {
        setErro('Este e-mail já foi confirmado. Faça login normalmente.');
      } else {
        setErro('Erro ao reenviar. Tente novamente em alguns minutos.');
      }
      // Mesmo no erro, inicia cooldown — evita marteladas no botão e novos
      // erros de rate limit em sequência.
      setCountdown(COOLDOWN_SEGUNDOS);
    } else {
      setMensagem('E-mail reenviado. Verifique sua caixa de entrada e spam.');
      setCountdown(COOLDOWN_SEGUNDOS);
    }
    setLoading(false);
  }

  const botaoDesabilitado = loading || countdown > 0;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-3xl bg-mint-50 border border-green-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
          ✉️
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Confirme seu e-mail</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Enviamos um link de confirmação para o seu e-mail. Verifique sua caixa de entrada e spam.
        </p>

        {mensagem && (
          <p className="mt-4 text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl py-2.5 px-4">
            {mensagem}
          </p>
        )}
        {erro && (
          <p className="mt-4 text-red-400 text-sm bg-red-500/10 rounded-xl py-2.5 px-4">
            {erro}
          </p>
        )}

        <Link
          href="/auth/login"
          className="inline-block mt-6 text-mint-500 text-sm font-medium"
        >
          ← Voltar para o login
        </Link>

        {email && (
          <div className="mt-4">
            <button
              onClick={handleReenviar}
              disabled={botaoDesabilitado}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? 'Enviando...'
                : countdown > 0
                  ? `Reenviar novamente em ${countdown}s`
                  : 'Reenviar e-mail'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ConfirmarEmailPage() {
  return (
    <Suspense>
      <ConfirmarEmailContent />
    </Suspense>
  );
}
