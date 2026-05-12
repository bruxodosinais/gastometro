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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const deleted = searchParams.get('deleted') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-mint-50 border border-mint-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
            📊
          </div>
          <h1 className="text-2xl font-bold text-gray-900">GastôMetro</h1>
          <p className="text-gray-500 text-sm mt-1">Entre na sua conta</p>
        </div>

        {deleted && (
          <p className="text-green-600 text-sm text-center bg-green-500/10 rounded-xl py-2.5 px-4 mb-4">
            Conta excluída com sucesso.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl py-2.5 px-4">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 disabled:opacity-60 rounded-xl font-semibold text-white transition-colors"
            style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">
          <Link href="/auth/recuperar-senha" className="text-mint-500 font-medium hover:underline">
            Esqueci minha senha
          </Link>
        </p>

        <p className="text-center text-gray-500 text-sm mt-4">
          Não tem conta?{' '}
          <Link href="/auth/cadastro" className="text-mint-500 font-medium">
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
