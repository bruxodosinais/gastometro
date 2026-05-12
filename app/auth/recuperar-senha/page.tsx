'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-mint-50 border border-mint-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
            🔑
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Recuperar senha</h1>
          <p className="text-gray-500 text-sm mt-1">Informe seu e-mail para receber o link</p>
        </div>

        {mensagem ? (
          <div className="text-center">
            <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl py-3 px-4">
              {mensagem}
            </p>
            <Link
              href="/auth/login"
              className="inline-block mt-6 text-mint-500 text-sm font-medium"
            >
              ← Voltar para o login
            </Link>
          </div>
        ) : (
          <>
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

              {erro && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl py-2.5 px-4">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 disabled:opacity-60 rounded-xl font-semibold text-white transition-colors"
                style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
              >
                {loading ? 'Enviando...' : 'Enviar link'}
              </button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-6">
              <Link href="/auth/login" className="text-mint-500 font-medium">
                ← Voltar para o login
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
