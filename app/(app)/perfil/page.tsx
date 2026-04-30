'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function PerfilPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) { router.push('/auth/login'); return; }
      const meta = u.user_metadata as Record<string, string> | undefined;
      setDisplayName(
        meta?.display_name ||
        meta?.full_name?.split(' ')[0] ||
        meta?.name?.split(' ')[0] ||
        ''
      );
      setEmail(u.email ?? '');
      setLoading(false);
    });
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const trimmed = displayName.trim();
    if (!trimmed) { setError('Informe como quer ser chamado.'); setSaving(false); return; }
    const { error: err } = await createClient().auth.updateUser({
      data: { display_name: trimmed },
    });
    setSaving(false);
    if (err) { setError('Erro ao salvar. Tente novamente.'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <main className="max-w-lg mx-auto px-4 pt-8 pb-28 md:pb-10">
        <div className="skeleton h-8 w-32 rounded-lg mb-6" />
        <div className="skeleton h-48 rounded-2xl" />
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-28 md:pb-10" style={{ animation: 'fade-in 200ms ease-out both' }}>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-bold text-white">Perfil</h1>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-300 font-bold text-xl flex-shrink-0">
            {(displayName || email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-semibold">{displayName || email.split('@')[0]}</p>
            <p className="text-slate-500 text-sm">{email}</p>
          </div>
        </div>

        <div className="border-t border-slate-800" />

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
              Como quer ser chamado?
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome ou apelido"
              maxLength={40}
              autoComplete="nickname"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <p className="text-slate-600 text-xs mt-1.5">
              Esse nome aparece na saudação da tela inicial.
            </p>
          </div>

          <div>
            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-xl py-2.5 px-4 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || saved}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-70"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> Salvando…</>
            ) : saved ? (
              <><Check size={16} /> Salvo!</>
            ) : (
              'Salvar'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
