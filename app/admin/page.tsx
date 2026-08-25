'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminHeader } from './_components/AdminHeader';
import { AdminOverview } from './_components/AdminOverview';
import { AdminUsuarios } from './_components/AdminUsuarios';
import { AdminAtividade } from './_components/AdminAtividade';
import { AdminFeedback } from './_components/AdminFeedback';
import { AdminCupons } from './_components/AdminCupons';
import { AdminNotificacoes } from './_components/AdminNotificacoes';
import { AdminComunicacao } from './_components/AdminComunicacao';
import { Modal, PlanBadge, Row } from './_components/shared';
import { fmt } from './_components/utils';
import type {
  ActivityItem, Coupon, EmailSegment, FeedbackCategory, FeedbackItem,
  PushHistoryItem, PushTarget, Stats, StatusMessage, Subscription,
  TabKey, UserDetail, UserRow,
} from './_components/types';

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Feedback
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | FeedbackCategory>('all');

  // Users
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [userOrder, setUserOrder] = useState('created_at');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Modals
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Plano e Assinatura
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subMsg, setSubMsg] = useState<StatusMessage | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantDays, setGrantDays] = useState(30);
  const [grantLoading, setGrantLoading] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);

  // Churn expandir
  const [neverExpanded, setNeverExpanded] = useState(false);
  const [riskExpanded, setRiskExpanded] = useState(false);

  // Activity feed
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityVisible, setActivityVisible] = useState(20);

  // E-mail em massa
  const [emailSegment, setEmailSegment] = useState<EmailSegment>('all');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<StatusMessage | null>(null);

  // Cupons
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDays, setNewCouponDays] = useState(30);
  const [newCouponMaxUses, setNewCouponMaxUses] = useState(1);
  const [newCouponExpires, setNewCouponExpires] = useState('');
  const [couponMsg, setCouponMsg] = useState<StatusMessage | null>(null);
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  // Push notifications
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushUrl, setPushUrl] = useState('');
  const [pushTarget, setPushTarget] = useState<PushTarget>('all');
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState<StatusMessage | null>(null);
  const [pushHistory, setPushHistory] = useState<PushHistoryItem[]>([]);
  const [pushHistoryLoading, setPushHistoryLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  /* Fetch stats */
  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoadingStats(false); })
      .catch(() => setLoadingStats(false));
  }, []);

  /* Fetch feedback counter on load (para badge) */
  const fetchFeedback = useCallback(() => {
    setFeedbackLoading(true);
    fetch('/api/admin/feedback')
      .then(r => r.json())
      .then(d => {
        setFeedbackItems(d.items ?? []);
        setFeedbackUnread(d.unreadCount ?? 0);
      })
      .finally(() => setFeedbackLoading(false));
  }, []);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);
  useEffect(() => { if (tab === 'feedback') fetchFeedback(); }, [tab, fetchFeedback]);

  /* Fetch users */
  const fetchUsers = useCallback(() => {
    setLoadingUsers(true);
    const params = new URLSearchParams({
      page: String(userPage), limit: '20',
      search: userSearch, filter: userFilter, orderBy: userOrder,
    });
    fetch(`/api/admin/users?${params}`)
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setUsersTotal(d.total ?? 0); setLoadingUsers(false); })
      .catch(() => setLoadingUsers(false));
  }, [userPage, userSearch, userFilter, userOrder]);

  useEffect(() => { if (tab === 'users') fetchUsers(); }, [tab, fetchUsers]);

  /* Fetch activity */
  const fetchActivity = useCallback(() => {
    setActivityLoading(true);
    fetch('/api/admin/activity')
      .then(r => r.json())
      .then(d => { setActivityItems(d.items ?? []); setActivityVisible(20); })
      .finally(() => setActivityLoading(false));
  }, []);

  useEffect(() => { if (tab === 'activity') fetchActivity(); }, [tab, fetchActivity]);

  /* Fetch coupons */
  const fetchCoupons = useCallback(() => {
    setCouponsLoading(true);
    fetch('/api/admin/coupons')
      .then(r => r.json())
      .then(d => setCoupons(d.items ?? []))
      .finally(() => setCouponsLoading(false));
  }, []);

  useEffect(() => { if (tab === 'coupons') fetchCoupons(); }, [tab, fetchCoupons]);

  /* Fetch push history */
  const fetchPushHistory = useCallback(() => {
    setPushHistoryLoading(true);
    fetch('/api/push/history?limit=20')
      .then(r => r.json())
      .then(d => setPushHistory(d.items ?? []))
      .finally(() => setPushHistoryLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'notifications' || tab === 'communication') fetchPushHistory();
  }, [tab, fetchPushHistory]);

  async function sendPushManual() {
    setPushSending(true);
    setPushResult(null);
    try {
      const r = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushTitle,
          message: pushMessage,
          url: pushUrl || '/',
          target: pushTarget,
        }),
      });
      const d = await r.json();
      if (r.ok && typeof d.sent === 'number') {
        setPushResult({
          kind: d.failed > 0 ? 'error' : 'success',
          text: `${d.sent} enviado(s), ${d.failed} falha(s). Total de devices: ${d.total ?? d.sent + d.failed}.`,
        });
        if (d.failed === 0) {
          setPushTitle(''); setPushMessage(''); setPushUrl('');
        }
        fetchPushHistory();
      } else {
        setPushResult({ kind: 'error', text: d.error ?? 'Erro ao enviar push.' });
      }
    } catch {
      setPushResult({ kind: 'error', text: 'Erro ao enviar push.' });
    } finally {
      setPushSending(false);
    }
  }

  async function createCoupon() {
    setCreatingCoupon(true);
    setCouponMsg(null);
    try {
      const r = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCouponCode || undefined,
          days: newCouponDays,
          max_uses: newCouponMaxUses,
          expires_at: newCouponExpires || null,
        }),
      });
      const d = await r.json();
      if (r.ok && d.coupon) {
        setCouponMsg({ kind: 'success', text: `Cupom ${d.coupon.code} criado.` });
        setNewCouponCode(''); setNewCouponDays(30); setNewCouponMaxUses(1); setNewCouponExpires('');
        fetchCoupons();
      } else {
        setCouponMsg({ kind: 'error', text: d.error ?? 'Erro ao criar cupom.' });
      }
    } catch {
      setCouponMsg({ kind: 'error', text: 'Erro ao criar cupom.' });
    } finally {
      setCreatingCoupon(false);
    }
  }

  async function deactivateCoupon(id: string) {
    await fetch('/api/admin/coupons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: false }),
    });
    fetchCoupons();
  }

  async function sendBulkEmail() {
    setEmailSending(true);
    setEmailResult(null);
    try {
      const r = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: emailSegment,
          subject: emailSubject,
          message: emailMessage,
        }),
      });
      const d = await r.json();
      if (r.ok && typeof d.sent === 'number') {
        setEmailResult({
          kind: d.failed > 0 ? 'error' : 'success',
          text: `Enviados: ${d.sent}. Falhas: ${d.failed}. Total: ${d.total ?? d.sent + d.failed}.`,
        });
        if (d.failed === 0) { setEmailSubject(''); setEmailMessage(''); }
      } else {
        setEmailResult({ kind: 'error', text: d.error ?? 'Erro ao enviar.' });
      }
    } catch {
      setEmailResult({ kind: 'error', text: 'Erro ao enviar.' });
    } finally {
      setEmailSending(false);
    }
  }

  /* Block/unblock */
  async function toggleBlock(u: UserRow) {
    const method = u.is_blocked ? 'DELETE' : 'POST';
    await fetch(`/api/admin/users/${u.id}/block`, { method });
    showToast(u.is_blocked ? 'Usuário desbloqueado.' : 'Usuário bloqueado.');
    fetchUsers();
    if (detailUser?.id === u.id) setDetailUser({ ...detailUser, is_blocked: !u.is_blocked });
  }

  /* Delete user */
  async function deleteUser(id: string) {
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    setDetailUser(null);
    showToast('Usuário excluído.');
    fetchUsers();
  }

  /* Open detail */
  async function openDetail(id: string) {
    setSubscription(null);
    setSubMsg(null);
    const r = await fetch(`/api/admin/users/${id}`);
    const d = await r.json();
    setDetailUser(d);
    loadSubscription(id);
  }

  async function loadSubscription(id: string) {
    setSubLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${id}/subscription`);
      const d = await r.json();
      setSubscription(d.subscription ?? null);
    } catch {
      setSubscription(null);
    } finally {
      setSubLoading(false);
    }
  }

  async function grantPro() {
    if (!detailUser) return;
    setGrantLoading(true);
    setSubMsg(null);
    try {
      const r = await fetch(`/api/admin/users/${detailUser.id}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: grantDays }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setSubMsg({ kind: 'success', text: `Pro concedido por ${grantDays} dia(s).` });
        setGrantOpen(false);
        await loadSubscription(detailUser.id);
        fetchUsers();
      } else {
        setSubMsg({ kind: 'error', text: d.error ?? 'Erro ao conceder Pro.' });
      }
    } catch {
      setSubMsg({ kind: 'error', text: 'Erro ao conceder Pro.' });
    } finally {
      setGrantLoading(false);
    }
  }

  async function revokePro() {
    if (!detailUser) return;
    setRevokeLoading(true);
    setSubMsg(null);
    try {
      const r = await fetch(`/api/admin/users/${detailUser.id}/subscription`, { method: 'DELETE' });
      const d = await r.json();
      if (r.ok && d.success) {
        setSubMsg({ kind: 'success', text: 'Pro revogado.' });
        setConfirmRevoke(false);
        await loadSubscription(detailUser.id);
        fetchUsers();
      } else {
        setSubMsg({ kind: 'error', text: d.error ?? 'Erro ao revogar Pro.' });
      }
    } catch {
      setSubMsg({ kind: 'error', text: 'Erro ao revogar Pro.' });
    } finally {
      setRevokeLoading(false);
    }
  }

  /* Send invite */
  async function sendInvite() {
    setInviteLoading(true);
    const r = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName }),
    });
    const d = await r.json();
    setInviteLoading(false);
    if (d.success) {
      setInviteMsg('Convite enviado com sucesso!');
      setInviteEmail(''); setInviteName('');
      setTimeout(() => { setInviteOpen(false); setInviteMsg(''); }, 2000);
    } else {
      setInviteMsg(d.error ?? 'Erro ao enviar convite.');
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminHeader tab={tab} setTab={setTab} feedbackUnread={feedbackUnread} />

      <main style={{ flex: 1, marginLeft: 220, padding: '32px 28px', maxWidth: 1100 }} className="admin-main">
        {tab === 'overview' && (
          <AdminOverview
            stats={stats}
            loadingStats={loadingStats}
            neverExpanded={neverExpanded}
            setNeverExpanded={setNeverExpanded}
            riskExpanded={riskExpanded}
            setRiskExpanded={setRiskExpanded}
          />
        )}

        {tab === 'users' && (
          <AdminUsuarios
            users={users}
            usersTotal={usersTotal}
            userPage={userPage}
            setUserPage={setUserPage}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            userFilter={userFilter}
            setUserFilter={setUserFilter}
            userOrder={userOrder}
            setUserOrder={setUserOrder}
            loadingUsers={loadingUsers}
            onFetchUsers={fetchUsers}
            onOpenInvite={() => setInviteOpen(true)}
            onOpenDetail={openDetail}
            onToggleBlock={toggleBlock}
            onConfirmDelete={setConfirmDelete}
          />
        )}

        {tab === 'activity' && (
          <AdminAtividade
            activityItems={activityItems}
            activityLoading={activityLoading}
            activityVisible={activityVisible}
            setActivityVisible={setActivityVisible}
            onFetchActivity={fetchActivity}
          />
        )}

        {tab === 'feedback' && (
          <AdminFeedback
            feedbackItems={feedbackItems}
            feedbackUnread={feedbackUnread}
            feedbackLoading={feedbackLoading}
            feedbackFilter={feedbackFilter}
            setFeedbackFilter={setFeedbackFilter}
            onFetchFeedback={fetchFeedback}
          />
        )}

        {tab === 'coupons' && (
          <AdminCupons
            coupons={coupons}
            couponsLoading={couponsLoading}
            newCouponCode={newCouponCode}
            setNewCouponCode={setNewCouponCode}
            newCouponDays={newCouponDays}
            setNewCouponDays={setNewCouponDays}
            newCouponMaxUses={newCouponMaxUses}
            setNewCouponMaxUses={setNewCouponMaxUses}
            newCouponExpires={newCouponExpires}
            setNewCouponExpires={setNewCouponExpires}
            couponMsg={couponMsg}
            creatingCoupon={creatingCoupon}
            onCreateCoupon={createCoupon}
            onDeactivateCoupon={deactivateCoupon}
          />
        )}

        {tab === 'notifications' && (
          <AdminNotificacoes
            pushTitle={pushTitle}
            setPushTitle={setPushTitle}
            pushMessage={pushMessage}
            setPushMessage={setPushMessage}
            pushUrl={pushUrl}
            setPushUrl={setPushUrl}
            pushTarget={pushTarget}
            setPushTarget={setPushTarget}
            pushSending={pushSending}
            pushResult={pushResult}
            pushHistory={pushHistory}
            pushHistoryLoading={pushHistoryLoading}
            onSendPushManual={sendPushManual}
          />
        )}

        {tab === 'communication' && (
          <AdminComunicacao
            emailSegment={emailSegment}
            setEmailSegment={setEmailSegment}
            emailSubject={emailSubject}
            setEmailSubject={setEmailSubject}
            emailMessage={emailMessage}
            setEmailMessage={setEmailMessage}
            emailSending={emailSending}
            emailResult={emailResult}
            onSendBulkEmail={sendBulkEmail}
            pushTitle={pushTitle}
            setPushTitle={setPushTitle}
            pushMessage={pushMessage}
            setPushMessage={setPushMessage}
            pushUrl={pushUrl}
            setPushUrl={setPushUrl}
            pushTarget={pushTarget}
            setPushTarget={setPushTarget}
            pushSending={pushSending}
            pushResult={pushResult}
            onSendPushManual={sendPushManual}
            pushHistory={pushHistory}
            pushHistoryLoading={pushHistoryLoading}
          />
        )}
      </main>

      {/* ── Modal: Detalhes do usuário ── */}
      {detailUser && (
        <Modal onClose={() => setDetailUser(null)}>
          <h2 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 18, color: '#111827' }}>Detalhes do usuário</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="E-mail" value={detailUser.email} />
            <Row label="Cadastro" value={fmt(detailUser.created_at)} />
            <Row label="Último acesso" value={fmt(detailUser.last_sign_in_at)} />
            <Row label="E-mail confirmado" value={detailUser.email_confirmed_at ? fmt(detailUser.email_confirmed_at) : 'Não'} />
            <Row label="Lançamentos" value={String(detailUser.launches_count)} />
            <Row label="Tem recorrente" value={detailUser.has_recurring ? 'Sim' : 'Não'} />
            <Row label="Tem cartão" value={detailUser.has_credit_card ? 'Sim' : 'Não'} />
            <Row label="Bloqueado" value={detailUser.is_blocked ? 'Sim' : 'Não'} />
          </div>

          {/* Plano e Assinatura */}
          <h3 style={{ margin: '24px 0 12px', fontWeight: 800, fontSize: 15, color: '#111827' }}>Plano e Assinatura</h3>
          {subLoading ? (
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Carregando assinatura…</p>
          ) : subscription ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, borderBottom: '1px solid var(--border-2)', paddingBottom: 8 }}>
                  <span style={{ color: '#374151' }}>Plano atual</span>
                  <PlanBadge plan={subscription.plan} billingCycle={subscription.billing_cycle} store={subscription.store} />
                </div>
                <Row label="Status" value={subscription.status} />
                <Row label="Ciclo de cobrança" value={subscription.billing_cycle ?? '—'} />
                <Row label="Vence em" value={fmt(subscription.current_period_end)} />
                <Row
                  label="Origem"
                  value={
                    subscription.store === 'app_store' ? 'App Store (iOS)'
                      : subscription.store === 'play_store' ? 'Play Store (Android)'
                        : subscription.plan === 'pro' ? '—' : '—'
                  }
                />
              </div>

              {subMsg && (
                <p style={{
                  fontSize: 13, margin: '12px 0 0',
                  color: subMsg.kind === 'success' ? 'var(--green)' : 'var(--red)',
                }}>{subMsg.text}</p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {subscription.plan === 'free' && (
                  <button onClick={() => { setGrantDays(30); setSubMsg(null); setGrantOpen(true); }} style={{
                    padding: '10px 18px', background: '#FFF4CC', color: '#7a5d00', border: '1px solid #f0d97a',
                    borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
                  }}>
                    Conceder Pro
                  </button>
                )}
                {subscription.plan === 'pro' && subscription.billing_cycle === 'manual' && (
                  <button onClick={() => { setSubMsg(null); setConfirmRevoke(true); }} style={{
                    padding: '10px 18px', background: 'var(--red-bg)', color: 'var(--red)', border: 'none',
                    borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
                  }}>
                    Revogar Pro
                  </button>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Sem dados de assinatura.</p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            <button onClick={() => toggleBlock(detailUser)} style={{
              padding: '10px 18px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, background: 'var(--surface)',
              color: detailUser.is_blocked ? 'var(--green)' : 'var(--yellow-text)',
            }}>
              {detailUser.is_blocked ? 'Desbloquear' : 'Bloquear'}
            </button>
            <button onClick={() => setConfirmDelete(detailUser.id)} style={{
              padding: '10px 18px', background: 'var(--red-bg)', color: 'var(--red)', border: 'none',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>Excluir conta</button>
            <button onClick={() => setDetailUser(null)} style={{
              padding: '10px 18px', background: 'var(--surface)', color: '#374151', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, marginLeft: 'auto',
            }}>Fechar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Convidar usuário ── */}
      {inviteOpen && (
        <Modal onClose={() => { setInviteOpen(false); setInviteMsg(''); }}>
          <h2 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 18, color: '#111827' }}>Convidar usuário</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
              E-mail *
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
              Nome (opcional)
              <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                placeholder="Nome do convidado"
                style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14 }}
              />
            </label>
            {inviteMsg && (
              <p style={{ color: inviteMsg.includes('sucesso') ? 'var(--green)' : 'var(--red)', fontSize: 13, margin: 0 }}>{inviteMsg}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={sendInvite} disabled={inviteLoading || !inviteEmail} style={{
                padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
                opacity: inviteLoading || !inviteEmail ? 0.6 : 1,
              }}>
                {inviteLoading ? 'Enviando…' : 'Enviar convite'}
              </button>
              <button onClick={() => { setInviteOpen(false); setInviteMsg(''); }} style={{
                padding: '10px 18px', background: 'var(--surface)', color: '#374151', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
              }}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Confirmar exclusão ── */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <h2 style={{ margin: '0 0 12px', fontWeight: 900, fontSize: 18, color: 'var(--red)' }}>Excluir usuário</h2>
          <p style={{ color: '#374151', fontSize: 14, margin: '0 0 20px' }}>
            Tem certeza? Esta ação é irreversível. Todos os dados do usuário serão excluídos permanentemente.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => deleteUser(confirmDelete)} style={{
              padding: '10px 18px', background: 'var(--red)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>Sim, excluir</button>
            <button onClick={() => setConfirmDelete(null)} style={{
              padding: '10px 18px', background: 'var(--surface)', color: '#374151', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Conceder Pro ── */}
      {grantOpen && detailUser && (
        <Modal onClose={() => setGrantOpen(false)}>
          <h2 style={{ margin: '0 0 12px', fontWeight: 800, fontSize: 18, color: '#111827' }}>Conceder Pro</h2>
          <p style={{ color: '#374151', fontSize: 14, margin: '0 0 16px' }}>
            Conceder plano Pro manualmente para <strong>{detailUser.email}</strong>.
          </p>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', color: '#374151' }}>
            Duração em dias
            <input
              type="number" min={1} value={grantDays}
              onChange={e => setGrantDays(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={grantPro} disabled={grantLoading} style={{
              padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
              opacity: grantLoading ? 0.6 : 1,
            }}>
              {grantLoading ? 'Concedendo…' : 'Confirmar'}
            </button>
            <button onClick={() => setGrantOpen(false)} style={{
              padding: '10px 18px', background: 'var(--surface)', color: '#374151', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Confirmar revogação Pro ── */}
      {confirmRevoke && detailUser && (
        <Modal onClose={() => setConfirmRevoke(false)}>
          <h2 style={{ margin: '0 0 12px', fontWeight: 900, fontSize: 18, color: 'var(--red)' }}>Revogar Pro</h2>
          <p style={{ color: '#374151', fontSize: 14, margin: '0 0 20px' }}>
            Tem certeza que deseja revogar o plano Pro de <strong>{detailUser.email}</strong>?
            O usuário voltará para o plano Free imediatamente.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={revokePro} disabled={revokeLoading} style={{
              padding: '10px 18px', background: 'var(--red)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
              opacity: revokeLoading ? 0.6 : 1,
            }}>{revokeLoading ? 'Revogando…' : 'Sim, revogar'}</button>
            <button onClick={() => setConfirmRevoke(false)} style={{
              padding: '10px 18px', background: 'var(--surface)', color: '#374151', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text)', color: '#fff', padding: '12px 24px', borderRadius: 12,
          fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}

      {/* CSS responsive */}
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-main {
            margin-left: 0 !important;
            padding: 72px 16px 20px !important;
            max-width: 100% !important;
          }
          .admin-topbar { display: flex !important; }
          .admin-drawer { display: flex !important; }
          .admin-mobile-tabs { display: none !important; }
          .admin-user-hide-mobile { display: none !important; }
        }
        @media (max-width: 640px) {
          .admin-metric-grid { grid-template-columns: 1fr !important; }
          .admin-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
