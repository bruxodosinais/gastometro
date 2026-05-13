'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Check, ChevronRight, Eye, EyeOff, Loader2, X } from 'lucide-react';
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
    const circleStyle: React.CSSProperties = {
      width: size, height: size,
      borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
    };

    if (uploadingAvatar) {
      return (
        <div style={{ ...circleStyle, background: 'var(--accent-bg)', border: '1.5px solid var(--border)' }}>
          <Loader2 size={20} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
        </div>
      );
    }
    if (avatarUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="Avatar" style={{ ...circleStyle, objectFit: 'cover' }} />
      );
    }
    if (avatarEmoji) {
      return (
        <div style={{ ...circleStyle, background: 'var(--accent-bg)', border: '1.5px solid var(--border)' }}>
          <span style={{ fontSize: size * 0.55 }}>{avatarEmoji}</span>
        </div>
      );
    }
    return (
      <div style={{ ...circleStyle, background: 'var(--accent)' }}>
        <span style={{ color: 'white', fontWeight: 800, fontSize: size * 0.38 }}>
          {(displayName || email).charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 440, margin: '0 auto', padding: '32px 16px 120px' }}>
        <div className="skeleton h-8 w-32 rounded-lg mb-6" />
        <div className="skeleton h-48 rounded-2xl" />
      </main>
    );
  }

  return (
    <>
      <main style={{ maxWidth: 440, margin: '0 auto', padding: '24px 16px 120px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} color="var(--text-2)" />
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Perfil</h1>
        </div>

        {/* Card principal */}
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 18, marginBottom: 12 }}>
          {/* Avatar + info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setAvatarMenuOpen(true)}
                style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                aria-label="Alterar foto de perfil"
              >
                {renderAvatar(56)}
                <span style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--accent)',
                  border: '2px solid var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Camera size={10} color="white" />
                </span>
              </button>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{displayName || email.split('@')[0]}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>{email}</p>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />

          <div style={{ height: 1, background: 'var(--border-2)', marginBottom: 16 }} />

          {/* Form */}
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Como quer ser chamado?
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome ou apelido"
                maxLength={40}
                autoComplete="nickname"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '12px 14px',
                  fontSize: 14, fontWeight: 700, color: 'var(--text)',
                  outline: 'none',
                }}
              />
              <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginTop: 6 }}>
                Esse nome aparece na saudação da tela inicial
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                disabled
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '12px 14px',
                  fontSize: 14, fontWeight: 700, color: 'var(--text)',
                  opacity: 0.6, cursor: 'not-allowed',
                }}
              />
            </div>

            {profileError && (
              <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px', textAlign: 'center', marginBottom: 12 }}>
                {profileError}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || saved}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--green)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                padding: 14,
                fontSize: 14, fontWeight: 800,
                cursor: saving || saved ? 'default' : 'pointer',
                opacity: saving || saved ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
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

          <div style={{ height: 1, background: 'var(--border-2)', margin: '14px 0' }} />

          <button
            type="button"
            onClick={handleLogout}
            style={{ display: 'block', width: '100%', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', marginTop: 4 }}
          >
            Sair da conta
          </button>
        </div>

        {/* Segurança */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
            Segurança
          </p>
          <button
            onClick={() => { setPwError(''); setNewPw(''); setConfirmPw(''); setPwModalOpen(true); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '12px 14px',
              fontSize: 13, fontWeight: 700, color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Alterar senha
            <ChevronRight size={16} color="var(--text-3)" />
          </button>
        </div>

        {/* Notificações */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
            Notificações
          </p>
          <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            {([
              { key: 'due_date_alerts' as const, label: 'Alertas de vencimento' },
              { key: 'weekly_email_summary' as const, label: 'Resumo semanal por e-mail' },
            ] as const).map(({ key, label }, idx) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px',
                borderTop: idx > 0 ? '1px solid var(--border-2)' : 'none',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                <button
                  role="switch"
                  aria-checked={notifPrefs[key]}
                  disabled={savingNotif}
                  onClick={() => handleNotifToggle(key)}
                  style={{
                    position: 'relative',
                    width: 44, height: 24, borderRadius: 12,
                    background: notifPrefs[key] ? 'var(--accent)' : 'var(--border)',
                    border: 'none', cursor: 'pointer',
                    transition: 'background 200ms',
                    flexShrink: 0,
                    opacity: savingNotif ? 0.6 : 1,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: notifPrefs[key] ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 200ms',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* LGPD */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
            Legal
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { href: '/termos', label: 'Ver termos de uso' },
              { href: '/privacidade', label: 'Ver política de privacidade' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '12px 14px',
                  fontSize: 13, fontWeight: 700, color: 'var(--text)',
                  textDecoration: 'none',
                }}
              >
                {label}
                <ChevronRight size={16} color="var(--text-3)" />
              </a>
            ))}
            <button
              onClick={() => { setDeleteError(''); setDeleteModalOpen(true); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                padding: '12px 14px',
                fontSize: 13, fontWeight: 700, color: 'var(--red)',
                cursor: 'pointer',
              }}
            >
              Excluir minha conta
              <ChevronRight size={16} color="var(--red)" />
            </button>
          </div>
        </div>
      </main>

      {/* Toast */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Avatar source picker modal */}
      {avatarMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setAvatarMenuOpen(false)}>
          <div style={{ width: '90%', maxWidth: 420, background: 'var(--surface)', borderRadius: 'var(--r)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ padding: '18px 20px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Foto de perfil</p>
            {[
              { label: 'Escolher foto da galeria', action: () => { setAvatarMenuOpen(false); fileInputRef.current?.click(); } },
              { label: 'Escolher avatar', action: () => { setAvatarMenuOpen(false); setEmojiModalOpen(true); } },
              { label: 'Cancelar', action: () => setAvatarMenuOpen(false) },
            ].map(({ label, action }, idx) => (
              <button
                key={label}
                onClick={action}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '14px 20px',
                  fontSize: 14, fontWeight: 600,
                  color: idx === 2 ? 'var(--text-3)' : 'var(--text)',
                  background: 'none', border: 'none', borderTop: '1px solid var(--border-2)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji avatar modal */}
      {emojiModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEmojiModalOpen(false)}>
          <div style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--r)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Escolher avatar</h3>
              <button onClick={() => setEmojiModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="var(--text-2)" />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  style={{
                    width: 44, height: 44, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                    background: avatarEmoji === emoji ? 'var(--accent-bg)' : 'var(--bg)',
                    border: avatarEmoji === emoji ? '2px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'transform 100ms',
                  }}
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
          <div style={{ width: '90%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--r)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Alterar senha</h3>
              <button onClick={() => setPwModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="var(--text-2)" />
              </button>
            </div>

            <form onSubmit={handlePasswordChange}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Nova senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 44px 12px 14px', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Confirmar nova senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repita a nova senha"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 44px 12px 14px', fontSize: 14, color: 'var(--text)', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {pwError && (
                <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px', textAlign: 'center', marginBottom: 12 }}>{pwError}</p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setPwModalOpen(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingPw} style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--r-sm)', background: 'var(--green)', border: 'none', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: savingPw ? 0.7 : 1 }}>
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
          <div style={{ width: '90%', maxWidth: 420, background: 'var(--surface)', borderRadius: 'var(--r)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Excluir conta</h3>
              <button onClick={() => !deleting && setDeleteModalOpen(false)} disabled={deleting} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
                <X size={16} color="var(--text-2)" />
              </button>
            </div>

            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
              Tem certeza? Todos os seus dados serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </p>

            {deleteError && (
              <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px', textAlign: 'center', marginBottom: 12 }}>{deleteError}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteModalOpen(false)} disabled={deleting} style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting} style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--r-sm)', background: 'var(--red)', border: 'none', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: deleting ? 0.6 : 1 }}>
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
