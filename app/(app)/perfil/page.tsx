'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Camera, Check, ChevronRight, Download, Eye, EyeOff, Headphones, Loader2, MessageCircle, X } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ToastContainer, useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/errors';
import { useSubscription } from '@/hooks/useSubscription';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTheme, type Theme } from '@/lib/themeContext';
import UpgradeBanner from '@/components/UpgradeBanner';
import LoadingButton from '@/components/ui/LoadingButton';
import { openSupport } from '@/components/SupportButton';

// Vinculação de WhatsApp (W2). Enquanto a feature está em desenvolvimento,
// um banner "Em breve" é renderizado por cima dos estados A/B/C.
// Trocar para `true` quando lançar.
const WHATSAPP_ENABLED = false;

// Mantém só dígitos e formata como telefone brasileiro: (11) 99999-9999.
function maskBrazilPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Recebe número salvo com DDI (5511999999999) e exibe (11) 99999-9999.
function formatStoredPhone(stored: string): string {
  const d = stored.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  return maskBrazilPhone(local);
}

const AVATAR_EMOJIS = [
  '🧑','👨','👩','🧔','👱','🧕','👴','👵','🧒','👦','👧','🧑‍💻',
  '🧑‍🎨','🧑‍🚀','🧑‍🍳','🦸','🦹','🧙','🥷','🧝','🧛','🤖',
];

type NotifPrefs = { due_date_alerts: boolean };
type EmailReports = { weekly: boolean; monthly: boolean };
type PushPrefs = { due_tomorrow: boolean; budget_exceeded: boolean; weekly_summary: boolean };

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
  const { isPro, billingCycle, currentPeriodEnd, loading: subLoading } = useSubscription();
  const push = usePushNotifications();
  const { theme, setTheme } = useTheme();

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
  });
  const [savingNotif, setSavingNotif] = useState(false);

  // Email reports (colunas dedicadas em profiles)
  const [emailReports, setEmailReports] = useState<EmailReports>({
    weekly: true,
    monthly: true,
  });
  const [savingEmail, setSavingEmail] = useState(false);

  // Push preferences
  const [pushPrefs, setPushPrefs] = useState<PushPrefs>({
    due_tomorrow: true,
    budget_exceeded: true,
    weekly_summary: true,
  });
  const [savingPush, setSavingPush] = useState(false);
  const [activatingPush, setActivatingPush] = useState(false);

  // WhatsApp (W2)
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [waInput, setWaInput] = useState('');
  const [waOtp, setWaOtp] = useState('');
  const [waOtpSent, setWaOtpSent] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waVerifying, setWaVerifying] = useState(false);
  const [waUnlinking, setWaUnlinking] = useState(false);
  const [waError, setWaError] = useState('');
  const [waSuccess, setWaSuccess] = useState('');

  // Danger zone
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Export LGPD
  const [exporting, setExporting] = useState(false);

  // PWA: esconde o link "Instalar no celular" quando o app já roda em standalone.
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
  }, []);

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
          .select('avatar_url, avatar_emoji, notification_preferences, email_report_weekly, email_report_monthly, push_due_tomorrow, push_budget_exceeded, push_weekly_summary, whatsapp_phone, whatsapp_verified')
          .eq('id', user.id)
          .single();

        if (profile) {
          setAvatarUrl(profile.avatar_url ?? null);
          setAvatarEmoji(profile.avatar_emoji ?? null);
          if (profile.notification_preferences) {
            const raw = profile.notification_preferences as Record<string, unknown>;
            setNotifPrefs({ due_date_alerts: raw.due_date_alerts !== false });
          }
          setEmailReports({
            weekly: profile.email_report_weekly !== false,
            monthly: profile.email_report_monthly !== false,
          });
          setPushPrefs({
            due_tomorrow: profile.push_due_tomorrow !== false,
            budget_exceeded: profile.push_budget_exceeded !== false,
            weekly_summary: profile.push_weekly_summary !== false,
          });
          setWhatsappPhone(profile.whatsapp_phone ?? null);
          setWhatsappVerified(profile.whatsapp_verified === true);
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

  async function handleActivatePush() {
    setActivatingPush(true);
    try {
      const ok = await push.subscribe();
      if (ok) {
        addToast('Notificações push ativadas!');
      } else if (push.permission === 'denied') {
        addToast('Permissão negada. Habilite nas configurações do navegador.', 'error');
      } else {
        addToast('Não foi possível ativar push neste dispositivo.', 'error');
      }
    } finally {
      setActivatingPush(false);
    }
  }

  async function handleDisablePush() {
    setActivatingPush(true);
    try {
      const ok = await push.unsubscribe();
      if (ok) addToast('Notificações push desativadas.');
    } finally {
      setActivatingPush(false);
    }
  }

  async function handlePushPrefToggle(key: keyof PushPrefs) {
    const updated = { ...pushPrefs, [key]: !pushPrefs[key] };
    setPushPrefs(updated);
    setSavingPush(true);
    try {
      const supabase = createClient();
      const column =
        key === 'due_tomorrow' ? 'push_due_tomorrow' :
        key === 'budget_exceeded' ? 'push_budget_exceeded' :
        'push_weekly_summary';
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        [column]: updated[key],
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch {
      setPushPrefs(pushPrefs);
      addToast('Erro ao salvar preferência.', 'error');
    } finally {
      setSavingPush(false);
    }
  }

  async function handleEmailReportToggle(key: keyof EmailReports) {
    const updated = { ...emailReports, [key]: !emailReports[key] };
    setEmailReports(updated);
    setSavingEmail(true);
    try {
      const supabase = createClient();
      const column = key === 'weekly' ? 'email_report_weekly' : 'email_report_monthly';
      await supabase.from('profiles').upsert({
        id: userId,
        [column]: updated[key],
        updated_at: new Date().toISOString(),
      });
    } catch {
      setEmailReports(emailReports);
      addToast('Erro ao salvar preferência.', 'error');
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSendWhatsappOtp() {
    setWaError('');
    setWaSuccess('');
    const digits = waInput.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      setWaError('Informe um número válido com DDD.');
      return;
    }
    setWaSending(true);
    try {
      const res = await fetch('/api/whatsapp/link-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `55${digits}` }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setWaError(data.error ?? 'Não foi possível enviar o código.');
        return;
      }
      setWaOtpSent(true);
      setWaSuccess('Código enviado pelo WhatsApp. Confira sua conversa.');
    } catch {
      setWaError('Erro de conexão. Tente novamente.');
    } finally {
      setWaSending(false);
    }
  }

  async function handleVerifyWhatsappOtp() {
    setWaError('');
    setWaSuccess('');
    const otp = waOtp.replace(/\D/g, '');
    if (otp.length !== 6) {
      setWaError('Digite o código de 6 dígitos.');
      return;
    }
    setWaVerifying(true);
    try {
      const res = await fetch('/api/whatsapp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setWaError(data.error ?? 'Não foi possível verificar o código.');
        return;
      }
      setWhatsappPhone(`55${waInput.replace(/\D/g, '')}`);
      setWhatsappVerified(true);
      setWaOtpSent(false);
      setWaOtp('');
      setWaInput('');
      addToast('WhatsApp vinculado com sucesso!');
    } catch {
      setWaError('Erro de conexão. Tente novamente.');
    } finally {
      setWaVerifying(false);
    }
  }

  async function handleUnlinkWhatsapp() {
    setWaUnlinking(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        whatsapp_phone: null,
        whatsapp_verified: false,
        whatsapp_otp: null,
        whatsapp_otp_expires_at: null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setWhatsappPhone(null);
      setWhatsappVerified(false);
      setWaOtpSent(false);
      setWaOtp('');
      setWaInput('');
      setWaError('');
      setWaSuccess('');
      addToast('WhatsApp desvinculado.');
    } catch {
      addToast('Erro ao desvincular. Tente novamente.', 'error');
    } finally {
      setWaUnlinking(false);
    }
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const res = await fetch('/api/export-my-data');
      if (!res.ok) {
        addToast('Não foi possível exportar seus dados. Tente novamente.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados-toorganizado.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast('Download iniciado!');
    } catch {
      addToast('Erro ao exportar dados. Tente novamente.', 'error');
    } finally {
      setExporting(false);
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
              {!subLoading && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 6,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: isPro ? 'var(--accent)' : 'var(--accent-bg)',
                    color: isPro ? '#fff' : 'var(--accent)',
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                  }}
                >
                  {isPro ? 'PRO ✓' : 'FREE'}
                </span>
              )}
            </div>
          </div>

          {!subLoading && (
            <Link
              href="/upgrade"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '12px 14px',
                marginBottom: 16,
                borderRadius: 'var(--r-sm)',
                background: isPro ? 'var(--accent-bg)' : 'var(--bg)',
                border: `1.5px solid ${isPro ? 'rgba(91,91,214,0.25)' : 'var(--border)'}`,
                textDecoration: 'none',
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  {isPro ? 'TôOrganizado Pro' : 'Plano gratuito'}
                </p>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', margin: 0, marginTop: 2 }}>
                  {isPro
                    ? `${billingCycle === 'annual' ? 'Anual' : billingCycle === 'monthly' ? 'Mensal' : 'Ativa'}${currentPeriodEnd ? ` • Renova em ${currentPeriodEnd.toLocaleDateString('pt-BR')}` : ''}`
                    : 'Lançamentos limitados • Sem metas, patrimônio ou cartões'}
                </p>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {isPro ? 'Gerenciar' : 'Fazer upgrade'}
              </span>
            </Link>
          )}

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
                background: 'var(--accent)',
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

        {/* Aparência */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
            Aparência
          </p>
          <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 6 }}>
            {([
              { value: 'light' as const, label: '☀️ Claro' },
              { value: 'dark' as const, label: '🌙 Escuro' },
              { value: 'system' as const, label: '💻 Sistema' },
            ]).map(({ value, label }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value as Theme)}
                  aria-pressed={selected}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: selected ? 'var(--accent)' : 'var(--surface)',
                    color: selected ? '#fff' : 'var(--text-2)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 150ms, color 150ms',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notificações */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
            Notificações
          </p>
          <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            {([
              { key: 'due_date_alerts' as const, label: 'Alertas de vencimento' },
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

        {/* Notificações push */}
        {push.isSupported && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
              Notificações push
            </p>
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
              {push.permission !== 'granted' || !push.subscribed ? (
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Bell size={18} color="var(--accent)" />
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                      Receba avisos importantes
                    </p>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', margin: '0 0 12px' }}>
                    Contas vencendo, orçamento estourado e resumo semanal direto no seu dispositivo.
                  </p>
                  {push.permission === 'denied' ? (
                    <p style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 12px', margin: 0 }}>
                      Permissão negada. Habilite nas configurações do navegador para receber pushes.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleActivatePush}
                      disabled={activatingPush || push.loading}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--r-sm)',
                        padding: 12,
                        fontSize: 13, fontWeight: 800,
                        cursor: activatingPush || push.loading ? 'default' : 'pointer',
                        opacity: activatingPush || push.loading ? 0.7 : 1,
                      }}
                    >
                      {activatingPush ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
                      {activatingPush ? 'Ativando…' : 'Ativar notificações push'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {([
                    { key: 'due_tomorrow' as const, label: '🔔 Conta vencendo amanhã' },
                    { key: 'budget_exceeded' as const, label: '⚠️ Orçamento estourado' },
                    { key: 'weekly_summary' as const, label: '📊 Resumo semanal push' },
                  ] as const).map(({ key, label }, idx) => (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px',
                      borderTop: idx > 0 ? '1px solid var(--border-2)' : 'none',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                      <button
                        role="switch"
                        aria-checked={pushPrefs[key]}
                        disabled={savingPush}
                        onClick={() => handlePushPrefToggle(key)}
                        style={{
                          position: 'relative',
                          width: 44, height: 24, borderRadius: 12,
                          background: pushPrefs[key] ? 'var(--accent)' : 'var(--border)',
                          border: 'none', cursor: 'pointer',
                          transition: 'background 200ms',
                          flexShrink: 0,
                          opacity: savingPush ? 0.6 : 1,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: 2,
                          left: pushPrefs[key] ? 22 : 2,
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'white',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          transition: 'left 200ms',
                        }} />
                      </button>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-2)', padding: 14 }}>
                    <button
                      type="button"
                      onClick={handleDisablePush}
                      disabled={activatingPush}
                      style={{
                        background: 'none', border: 'none',
                        color: 'var(--red)', fontSize: 12, fontWeight: 700,
                        cursor: activatingPush ? 'default' : 'pointer',
                        padding: 0,
                        opacity: activatingPush ? 0.6 : 1,
                      }}
                    >
                      Desativar pushes neste dispositivo
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Notificações por e-mail */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
            Notificações por e-mail
          </p>
          <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            {([
              { key: 'weekly' as const, label: 'Relatório semanal', hint: 'Toda segunda-feira' },
              { key: 'monthly' as const, label: 'Relatório mensal', hint: 'Todo dia 1º' },
            ] as const).map(({ key, label, hint }, idx) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px',
                borderTop: idx > 0 ? '1px solid var(--border-2)' : 'none',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: '2px 0 0' }}>{hint}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={emailReports[key]}
                  disabled={savingEmail}
                  onClick={() => handleEmailReportToggle(key)}
                  style={{
                    position: 'relative',
                    width: 44, height: 24, borderRadius: 12,
                    background: emailReports[key] ? 'var(--accent)' : 'var(--border)',
                    border: 'none', cursor: 'pointer',
                    transition: 'background 200ms',
                    flexShrink: 0,
                    opacity: savingEmail ? 0.6 : 1,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: emailReports[key] ? 22 : 2,
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

        {/* WhatsApp (W2) */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
            WhatsApp
          </p>

          {!WHATSAPP_ENABLED ? (
            /* Estado "Em breve" — informativo, sem ações */
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'var(--accent-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                }}>
                  💬
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                    Bot WhatsApp — Em breve
                  </p>
                  <span style={{
                    display: 'inline-block', marginTop: 4,
                    padding: '2px 8px', borderRadius: 999,
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 10, fontWeight: 900, letterSpacing: '0.04em',
                  }}>
                    Exclusivo Pro
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                Registre gastos e receitas direto pelo WhatsApp. Digite &quot;gastei 50 no iFood&quot; e o app registra automaticamente.
              </p>
            </div>
          ) : !isPro ? (
            /* Estado C — usuário Free */
            <UpgradeBanner
              message="Vinculação de WhatsApp é exclusiva do plano Pro"
              feature="whatsapp"
            />
          ) : whatsappVerified && whatsappPhone ? (
            /* Estado B — vinculado */
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--green-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <MessageCircle size={18} color="var(--green-text)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                    {formatStoredPhone(whatsappPhone)}
                  </p>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
                    padding: '2px 8px', borderRadius: 999,
                    background: 'var(--green-bg)', color: 'var(--green-text)',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    <Check size={11} /> Conectado
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUnlinkWhatsapp}
                disabled={waUnlinking}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'transparent',
                  border: '1.5px solid var(--red)',
                  borderRadius: 'var(--r-sm)',
                  padding: 12,
                  fontSize: 13, fontWeight: 800, color: 'var(--red)',
                  cursor: waUnlinking ? 'default' : 'pointer',
                  opacity: waUnlinking ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {waUnlinking ? <Loader2 size={15} className="animate-spin" /> : null}
                {waUnlinking ? 'Desvinculando…' : 'Desvincular'}
              </button>
            </div>
          ) : (
            /* Estado A — não vinculado (Pro) */
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <MessageCircle size={18} color="var(--accent)" />
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  Vincular WhatsApp
                </p>
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Registre gastos pelo WhatsApp. Enviaremos um código de verificação para o número informado.
              </p>

              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Número com DDD
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={waInput}
                onChange={(e) => setWaInput(maskBrazilPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                disabled={waOtpSent}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: waOtpSent ? 'var(--bg)' : 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '12px 14px',
                  fontSize: 16, fontWeight: 700, color: 'var(--text)',
                  outline: 'none',
                  opacity: waOtpSent ? 0.6 : 1,
                }}
              />

              {!waOtpSent ? (
                <button
                  type="button"
                  onClick={handleSendWhatsappOtp}
                  disabled={waSending}
                  style={{
                    marginTop: 12,
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    padding: 14,
                    fontSize: 14, fontWeight: 800,
                    cursor: waSending ? 'default' : 'pointer',
                    opacity: waSending ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {waSending ? <Loader2 size={16} className="animate-spin" /> : null}
                  {waSending ? 'Enviando…' : 'Enviar código'}
                </button>
              ) : (
                <>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', margin: '14px 0 6px' }}>
                    Código de verificação
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={waOtp}
                    onChange={(e) => setWaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      padding: '12px 14px',
                      fontSize: 16, fontWeight: 800, color: 'var(--text)',
                      letterSpacing: '0.3em', textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => { setWaOtpSent(false); setWaOtp(''); setWaError(''); setWaSuccess(''); }}
                      disabled={waVerifying}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 'var(--r-sm)',
                        border: '1.5px solid var(--border)', background: 'var(--surface)',
                        fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
                        cursor: waVerifying ? 'default' : 'pointer',
                        opacity: waVerifying ? 0.6 : 1,
                      }}
                    >
                      Trocar número
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyWhatsappOtp}
                      disabled={waVerifying}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 'var(--r-sm)',
                        background: 'var(--accent)', border: 'none',
                        fontSize: 13, fontWeight: 800, color: 'white',
                        cursor: waVerifying ? 'default' : 'pointer',
                        opacity: waVerifying ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {waVerifying ? <Loader2 size={15} className="animate-spin" /> : null}
                      {waVerifying ? 'Verificando…' : 'Verificar'}
                    </button>
                  </div>
                </>
              )}

              {waError && (
                <p style={{ color: 'var(--red)', fontSize: 12, background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                  {waError}
                </p>
              )}
              {waSuccess && !waError && (
                <p style={{ color: 'var(--green-text)', fontSize: 12, background: 'var(--green-bg)', borderRadius: 'var(--r-sm)', padding: '10px 14px', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                  {waSuccess}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Instalação */}
        {!isStandalone && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
              Instalação
            </p>
            <Link
              href="/instalar"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                padding: '12px 14px',
                fontSize: 13, fontWeight: 700, color: 'var(--text)',
                textDecoration: 'none',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>📲</span>
                Instalar no celular
              </span>
              <ChevronRight size={16} color="var(--text-3)" />
            </Link>
          </div>
        )}

        {/* Suporte */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, padding: '0 2px' }}>
            Suporte
          </p>
          <button
            type="button"
            onClick={() => openSupport()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '12px 14px',
              fontSize: 13, fontWeight: 700, color: 'var(--text)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Headphones size={16} color="var(--accent)" />
              Falar com suporte
            </span>
            <ChevronRight size={16} color="var(--text-3)" />
          </button>
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
              onClick={handleExportData}
              disabled={exporting}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                padding: '12px 14px',
                fontSize: 13, fontWeight: 700, color: 'var(--text)',
                cursor: exporting ? 'default' : 'pointer',
                opacity: exporting ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {exporting ? (
                  <Loader2 size={16} color="var(--accent)" className="animate-spin" />
                ) : (
                  <Download size={16} color="var(--accent)" />
                )}
                {exporting ? 'Exportando…' : 'Exportar meus dados'}
              </span>
              <ChevronRight size={16} color="var(--text-3)" />
            </button>
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
                <LoadingButton type="submit" loading={savingPw} style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--r-sm)', background: 'var(--accent)', border: 'none', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: savingPw ? 0.7 : 1 }}>
                  Salvar
                </LoadingButton>
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
