'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
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
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Se a sessão já foi criada (confirmação de e-mail desativada), redireciona
    if (data.session) {
      router.push('/');
      router.refresh();
      return;
    }

    // Caso contrário, pede para verificar o e-mail
    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-3xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
            ✉️
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Verifique seu e-mail</h2>
          <p className="text-slate-400 text-sm">
            Enviamos um link de confirmação para{' '}
            <span className="text-white font-medium">{email}</span>. Clique no link para ativar
            sua conta.
          </p>
          <Link
            href="/auth/login"
            className="inline-block mt-6 text-violet-400 hover:text-violet-300 text-sm font-medium"
          >
            ← Voltar para o login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
            📊
          </div>
          <h1 className="text-2xl font-bold text-white">GastôMetro</h1>
          <p className="text-slate-400 text-sm mt-1">Crie sua conta gratuita</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu primeiro nome"
              required
              autoComplete="given-name"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete="new-password"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Confirmar senha
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
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
            className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl font-semibold text-white transition-colors"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-6">
          Já tem conta?{' '}
          <Link href="/auth/login" className="text-violet-400 hover:text-violet-300 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
