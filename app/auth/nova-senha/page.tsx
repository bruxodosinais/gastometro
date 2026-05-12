'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NovaSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (senha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setErro('Não foi possível atualizar a senha. Tente novamente.');
      setLoading(false);
      return;
    }

    setSucesso(true);
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 2000);
  }

  if (sucesso) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-3xl bg-mint-50 border border-green-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
            ✅
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Senha atualizada!</h2>
          <p className="text-gray-500 text-sm">Redirecionando para o início...</p>
          <Link href="/" className="inline-block mt-6 text-mint-500 text-sm font-medium">
            Ir para o início →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-mint-50 border border-mint-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nova senha</h1>
          <p className="text-gray-500 text-sm mt-1">Escolha uma nova senha para sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Nova senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              autoComplete="new-password"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
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
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </main>
  );
}
