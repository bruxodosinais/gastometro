'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ToastContainer, useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/errors';

const AVATAR_EMOJIS = [
  '🧑','👨','👩','🧔','👱','🧕','👴','👵','🧒','👦','👧','🧑‍💻',
  '🧑‍🎨','🧑‍🚀','🧑‍🍳','🦸','🦹','🧙','🥷','🧝','🧛','🤖',
];

type NotifPrefs = { due_date_alerts: boolean; weekly_email_summary: boolean };

async function handleLogout() {
  await createClient().auth.signOut();
  window.location.href = '/auth/login';
}

function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d')!;
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao converter imagem'));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function PerfilPage() {
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();

  // Basic profile
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [emojiModalOpen, setEmojiModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    due_date_alerts: true,
    weekly_email_summary: false,
  });
  const [savingNotif, setSavingNotif] = useState(false);

  // Danger zone
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth/login'); return; }

        const meta = user.user_metadata as Record<string, string> | undefined;
        setUserId(user.id);
        setDisplayName(
          meta?.display_name || meta?.full_name?.split(' ')[0] || meta?.name?.split(' ')[0] || ''
        );
        setEmail(user.email ?? '');

        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, avatar_emoji, notification_preferences')
          .eq('id', user.id)
          .single();

        if (profile) {
          setAvatarUrl(profile.avatar_url ?? null);
          setAvatarEmoji(profile.avatar_emoji ?? null);
          if (profile.notification_preferences) {
            setNotifPrefs(profile.notification_preferences as NotifPrefs);
          }
        }
      } catch (err) {
        setProfileError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMenuOpen(false);
    setUploadingAvatar(true);
    try {
      const blob = await resizeImage(file);
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').upsert({
        id: userId,
        avatar_url: publicUrl,
        avatar_emoji: null,
        updated_at: new Date().toISOString(),
      });
      setAvatarUrl(publicUrl);
      setAvatarEmoji(null);
      addToast('Foto atualizada!');
    } catch {
      addToast('Erro ao fazer upload da foto.', 'error');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleEmojiSelect(emoji: string) {
    setEmojiModalOpen(false);
    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      await supabase.from('profiles').upsert({
        id: userId,
        avatar_emoji: emoji,
        avatar_url: null,
        updated_at: new Date().toISOString(),
      });
      setAvatarEmoji(emoji);
      setAvatarUrl(null);
      addToast('Avatar atualizado!');
    } catch {
      addToast('Erro ao salvar avatar.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError('');
    setSaving(true);
    const trimmed = displayName.trim();
    if (!trimmed) { setProfileError('Informe como quer ser chamado.'); setSaving(false); return; }
    const { error: err } = await createClient().auth.updateUser({ data: { display_name: trimmed } });
    setSaving(false);
    if (err) { setProfileError('Erro ao salvar. Tente novamente.'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (newPw.length < 6) { setPwError('A senha deve ter no mínimo 6 caracteres.'); return; }
    if (newPw !== confirmPw) { setPwError('As senhas não coincidem.'); return; }
    setSavingPw(true);
    const { error } = await createClient().auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) { setPwError('Erro ao alterar senha. Tente novamente.'); return; }
    setPwModalOpen(false);
    setNewPw('');
    setConfirmPw('');
    addToast('Senha alterada com sucesso!');
  }

  async function handleNotifToggle(key: keyof NotifPrefs) {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    setSavingNotif(true);
    try {
      const supabase = createClient();
      await supabase.from('profiles').upsert({
        id: userId,
        notification_preferences: updated,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // revert on error
      setNotifPrefs(notifPrefs);
      addToast('Erro ao salvar preferência.', 'error');
    } finally {
      setSavingNotif(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    setDeleting(true);
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setDeleteError(data.error ?? 'Erro ao excluir conta. Tente novamente.');
        setDeleting(false);
        return;
      }
      await createClient().auth.signOut();
      window.location.href = '/auth/login?deleted=1';
    } catch {
      setDeleteError('Erro ao excluir conta. Tente novamente.');
      setDeleting(false);
    }
  }

  function renderAvatar(size = 56) {
    const cls = `rounded-2xl bg-mint-50 border border-mint-500/40 flex items-center justify-center overflow-hidden flex-shrink-0`;
    const style = { width: size, height: size };

    if (uploadingAvatar) {
      return (
        <div className={cls} style={style}>
          <Loader2 size={20} className="animate-spin text-mint-500" />
        </div>
      );
    }
    if (avatarUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="Avatar" className={`${cls} object-cover`} style={style} />
      );
    }
    if (avatarEmoji) {
      return (
        <div className={cls} style={style}>
          <span style={{ fontSize: size * 0.55 }}>{avatarEmoji}</span>
        </div>
      );
    }
    return (
      <div className={cls} style={{ ...style }}>
        <span className="text-mint-500 font-bold" style={{ fontSize: size * 0.38 }}>
          {(displayName || email).charAt(0).toUpperCase()}
        </span>
      </div>
    );
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
    <>
      <main className="max-w-lg mx-auto px-4 pt-8 pb-28 md:pb-10 space-y-4" style={{ animation: 'fade-in 200ms ease-out both' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Perfil</h1>
        </div>

        {/* Profile card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
          {/* Avatar + info */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setAvatarMenuOpen(true)}
                className="relative focus:outline-none"
                aria-label="Alterar foto de perfil"
              >
                {renderAvatar(56)}
                <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-mint-500 border-2 border-white flex items-center justify-center">
                  <Camera size={10} className="text-white" />
                </span>
              </button>
            </div>

            <div>
              <p className="text-gray-900 font-semibold">{displayName || email.split('@')[0]}</p>
              <p className="text-gray-500 text-sm">{email}</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="border-t border-gray-100" />

          {/* Name + email form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                Como quer ser chamado?
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome ou apelido"
                maxLength={40}
                autoComplete="nickname"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
              />
              <p className="text-gray-500 text-xs mt-1.5">
                Esse nome aparece na saudação da tela inicial.
              </p>
            </div>

            <div>
              <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-gray-50/50 border border-gray-200/50 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed"
              />
            </div>

            {profileError && (
              <p className="text-red-400 text-sm bg-red-500/10 rounded-xl py-2.5 px-4 text-center">
                {profileError}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || saved}
              className="w-full py-3 rounded-xl font-semibold text-gray-900 transition-all flex items-center justify-center gap-2 bg-mint hover:bg-mint-700 disabled:opacity-70"
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

          <div className="border-t border-gray-100" />

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 text-red-400 text-sm font-medium hover:text-red-500 transition-colors"
          >
            Sair da conta
          </button>
        </div>

        {/* Security */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Segurança</h2>
          <button
            onClick={() => { setPwError(''); setNewPw(''); setConfirmPw(''); setPwModalOpen(true); }}
            className="w-full py-3 px-4 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors text-left"
          >
            Alterar senha
          </button>
        </div>

        {/* Notifications */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Notificações</h2>

          {[
            { key: 'due_date_alerts' as const, label: 'Alertas de vencimento' },
            { key: 'weekly_email_summary' as const, label: 'Resumo semanal por e-mail' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-gray-700 text-sm">{label}</span>
              <button
                role="switch"
                aria-checked={notifPrefs[key]}
                disabled={savingNotif}
                onClick={() => handleNotifToggle(key)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                  notifPrefs[key] ? 'bg-mint-500' : 'bg-gray-200'
                } disabled:opacity-60`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    notifPrefs[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Legal */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-3">
          <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Legal</h2>
          <a
            href="/termos"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 px-4 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Termos de Uso
          </a>
          <a
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 px-4 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Política de Privacidade
          </a>
        </div>

        {/* Danger zone */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-400">Zona de Perigo</h2>
          <button
            onClick={() => { setDeleteError(''); setDeleteModalOpen(true); }}
            className="w-full py-3 px-4 rounded-xl border border-red-300 text-red-400 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Excluir minha conta
          </button>
        </div>
      </main>

      {/* Toast */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Avatar source picker modal */}
      {avatarMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setAvatarMenuOpen(false)}>
          <div className="bg-white rounded-2xl overflow-hidden" style={{ width: '90%', maxWidth: 420, animation: 'fade-in 150ms ease-out both' }} onClick={(e) => e.stopPropagation()}>
            <p className="px-6 pt-5 pb-3 text-gray-500 text-xs font-semibold uppercase tracking-wider">Foto de perfil</p>
            <button
              onClick={() => { setAvatarMenuOpen(false); fileInputRef.current?.click(); }}
              className="w-full text-left px-6 py-4 text-sm text-gray-800 font-medium hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              Escolher foto da galeria
            </button>
            <button
              onClick={() => { setAvatarMenuOpen(false); setEmojiModalOpen(true); }}
              className="w-full text-left px-6 py-4 text-sm text-gray-800 font-medium hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              Escolher avatar
            </button>
            <button
              onClick={() => setAvatarMenuOpen(false)}
              className="w-full text-left px-6 py-4 text-sm text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Emoji avatar modal */}
      {emojiModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEmojiModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 space-y-4" style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', animation: 'fade-in 150ms ease-out both' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-gray-900 font-semibold">Escolher avatar</h3>
              <button onClick={() => setEmojiModalOpen(false)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl transition-all hover:bg-mint-50 hover:scale-110 ${
                    avatarEmoji === emoji ? 'bg-mint-50 ring-2 ring-mint-500' : 'bg-gray-50'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Password modal */}
      {pwModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setPwModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 space-y-4" style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', animation: 'fade-in 150ms ease-out both' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-gray-900 font-semibold">Alterar senha</h3>
              <button onClick={() => setPwModalOpen(false)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-11 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-500 text-xs font-medium uppercase tracking-wider block mb-1.5">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-11 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {pwError && (
                <p className="text-red-400 text-sm bg-red-500/10 rounded-xl py-2.5 px-4 text-center">
                  {pwError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPwModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPw}
                  className="flex-1 py-3 rounded-xl bg-mint font-semibold text-gray-900 text-sm flex items-center justify-center gap-2 hover:bg-mint-700 disabled:opacity-70 transition-colors"
                >
                  {savingPw ? <Loader2 size={15} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete account modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 space-y-4" style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', animation: 'fade-in 150ms ease-out both' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-gray-900 font-semibold">Excluir conta</h3>
              <button
                onClick={() => !deleting && setDeleteModalOpen(false)}
                disabled={deleting}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Tem certeza? Todos os seus dados serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </p>

            {deleteError && (
              <p className="text-red-400 text-sm bg-red-500/10 rounded-xl py-2.5 px-4 text-center">
                {deleteError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <><Loader2 size={15} className="animate-spin" /> Excluindo…</>
                ) : (
                  'Excluir minha conta'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
