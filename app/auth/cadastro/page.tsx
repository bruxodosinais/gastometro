'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function traduzirErroAuth(mensagem: string): string {
  if (mensagem.includes('User already registered'))
    return 'Este e-mail já está cadastrado.';
  if (mensagem.includes('Password should be at least 6 characters'))
    return 'A senha deve ter no mínimo 6 caracteres.';
  return mensagem;
}

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: { full_name: name.trim() },
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
    }

    if (data.session) {
      router.push('/');
      router.refresh();
      return;
    }

    localStorage.setItem('pending_confirmation_email', email);
    router.push(`/auth/confirmar-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-mint-50 border border-mint-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
            📊
          </div>
          <h1 className="text-2xl font-bold text-gray-900">GastôMetro</h1>
          <p className="text-gray-500 text-sm mt-1">Crie sua conta gratuita</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu primeiro nome"
              required
              autoComplete="given-name"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
            />
          </div>

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
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete="new-password"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Confirmar senha
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-mint-500 accent-mint-500 flex-shrink-0"
            />
            <span className="text-gray-600 text-sm leading-relaxed">
              Li e aceito os{' '}
              <Link
                href="/termos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mint-500 underline hover:text-mint-700"
              >
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mint-500 underline hover:text-mint-700"
              >
                Política de Privacidade
              </Link>
            </span>
          </label>

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl py-2.5 px-4">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !termsAccepted}
            className="w-full py-3.5 bg-mint hover:bg-mint-700 disabled:opacity-60 rounded-xl font-semibold text-gray-900 transition-colors"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Já tem conta?{' '}
          <Link href="/auth/login" className="text-mint-500 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
