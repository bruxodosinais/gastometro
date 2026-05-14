'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

/* ── Tipos ─────────────────────────────────────────────────────────────── */

interface Stats {
  users: {
    total: number; confirmed: number; unconfirmed: number;
    today: number; thisWeek: number; thisMonth: number;
    completedOnboarding: number; skippedOnboarding: number;
    withRecurring: number; withCreditCard: number; withCSVImport: number;
    neverLaunched: number; inactiveRisk: number;
  };
  launches: { total: number; avgPerUser: number; byDayOfWeek: number[]; weekGrowth: number };
  cards: { total: number };
  churn: {
    neverLaunched: { user_id: string; email: string; created_at: string }[];
    inactiveRisk: { user_id: string; email: string; created_at: string; lastLaunch: string | null }[];
  };
}

interface UserRow {
  id: string; email: string; created_at: string;
  last_sign_in_at: string | null; email_confirmed_at: string | null;
  launches_count: number; has_recurring: boolean; has_credit_card: boolean;
  is_blocked: boolean;
  plan: string;
  billing_cycle: string | null;
}

interface UserDetail extends UserRow { /* same shape */ }

interface Subscription {
  plan: string;
  status: string;
  billing_cycle: string | null;
  current_period_end: string | null;
  kiwify_order_id: string | null;
  kiwify_subscription_id: string | null;
  updated_at: string | null;
}

/* ── Utilitários ───────────────────────────────────────────────────────── */

function fmt(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/* ── Componentes menores ────────────────────────────────────────────────── */

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r)', padding: '20px 20px 16px',
      border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = pct(value, total);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-2)' }}>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{value} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>({p}%)</span></span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 4, height: 8 }}>
        <div style={{ width: `${p}%`, background: color, borderRadius: 4, height: 8, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
      {label}
    </span>
  );
}

function PlanBadge({ plan, billingCycle }: { plan: string; billingCycle: string | null }) {
  if (plan === 'pro' && billingCycle === 'manual') {
    return <Chip label="PRO manual" color="#7a5d00" bg="#FFF4CC" />;
  }
  if (plan === 'pro') {
    return <Chip label="PRO Kiwify" color="#3730a3" bg="#E0E7FF" />;
  }
  return <Chip label="FREE" color="#4b5563" bg="#E5E7EB" />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '32px 0 16px' }}>
      {children}
    </h2>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────────── */

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 'var(--r)', padding: 28,
          maxWidth: 500, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Dashboard principal ────────────────────────────────────────────────── */

export default function AdminPage() {
  const [tab, setTab] = useState<'overview' | 'users' | 'growth'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

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
  const [subMsg, setSubMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantDays, setGrantDays] = useState(30);
  const [grantLoading, setGrantLoading] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);

  // Churn expandir
  const [neverExpanded, setNeverExpanded] = useState(false);
  const [riskExpanded, setRiskExpanded] = useState(false);

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

  /* Growth data — cadastros por semana (últimas 8 semanas) */
  const growthData = (() => {
    if (!stats) return [];
    // Vamos usar os dados que temos — semanas relativas ao total conhecido
    // Precisaria de endpoint separado, mas o stats já tem thisWeek / thisMonth
    // Vamos exibir barras por dia da semana de lançamentos como proxy de crescimento
    return DAYS.map((d, i) => ({
      name: d,
      lançamentos: stats.launches.byDayOfWeek[i] ?? 0,
    }));
  })();

  /* ── Render ─────────────────────────────────────────────────────────── */

  const NAV_TABS = [
    { key: 'overview', label: 'Visão Geral' },
    { key: 'users', label: 'Usuários' },
    { key: 'growth', label: 'Gráfico' },
  ] as const;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar desktop */}
      <aside style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 4,
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10,
      }} className="admin-sidebar">
        <div style={{ padding: '0 20px 24px', fontWeight: 900, fontSize: 18, color: 'var(--accent)' }}>
          Admin
        </div>
        {NAV_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            textAlign: 'left', padding: '10px 20px', border: 'none', background: 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? 'var(--accent)' : 'var(--text-2)',
            borderLeft: tab === t.key ? '3px solid var(--accent)' : '3px solid transparent',
            transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <a href="/" style={{
          padding: '10px 20px', color: 'var(--text-3)', fontSize: 13, textDecoration: 'none',
        }}>← Voltar ao app</a>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 220, padding: '32px 28px', maxWidth: 1100 }} className="admin-main">
        {/* Mobile tabs */}
        <div className="admin-mobile-tabs" style={{ display: 'none', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
          {NAV_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
              background: tab === t.key ? 'var(--accent)' : 'var(--surface)',
              color: tab === t.key ? '#fff' : 'var(--text-2)',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── SEÇÃO 1: VISÃO GERAL ── */}
        {tab === 'overview' && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 24px' }}>Visão Geral</h1>

            {loadingStats ? (
              <p style={{ color: 'var(--text-3)' }}>Carregando métricas…</p>
            ) : stats ? (
              <>
                {/* Row 1 — Usuários */}
                <SectionTitle>Usuários</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  <MetricCard label="Total de usuários" value={stats.users.total} />
                  <MetricCard label="Hoje" value={stats.users.today} color="var(--accent)" />
                  <MetricCard label="Esta semana" value={stats.users.thisWeek} color="var(--accent)" />
                  <MetricCard label="Este mês" value={stats.users.thisMonth} color="var(--accent)" />
                </div>
                <div style={{
                  background: 'var(--surface)', borderRadius: 'var(--r)', padding: '20px',
                  border: '1px solid var(--border)', marginTop: 12,
                }}>
                  <ProgressBar label="Confirmados" value={stats.users.confirmed} total={stats.users.total} color="var(--green)" />
                  <ProgressBar label="Não confirmados" value={stats.users.unconfirmed} total={stats.users.total} color="var(--yellow)" />
                </div>

                {/* Row 2 — Engajamento */}
                <SectionTitle>Engajamento</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  <MetricCard label="Onboarding completo" value={stats.users.completedOnboarding}
                    sub={`${pct(stats.users.completedOnboarding, stats.users.total)}% do total`} />
                  <MetricCard label="Pularam onboarding" value={stats.users.skippedOnboarding}
                    sub={`${pct(stats.users.skippedOnboarding, stats.users.total)}% do total`} />
                  <MetricCard label="Com recorrente" value={stats.users.withRecurring}
                    sub={`${pct(stats.users.withRecurring, stats.users.total)}%`} color="var(--green)" />
                  <MetricCard label="Com cartão" value={stats.users.withCreditCard}
                    sub={`${pct(stats.users.withCreditCard, stats.users.total)}%`} />
                  <MetricCard label="Com importação CSV" value={stats.users.withCSVImport}
                    sub={`${pct(stats.users.withCSVImport, stats.users.total)}%`} />
                </div>

                {/* Row 3 — Lançamentos */}
                <SectionTitle>Lançamentos</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  <MetricCard label="Total de lançamentos" value={stats.launches.total.toLocaleString('pt-BR')} />
                  <MetricCard label="Média por usuário" value={stats.launches.avgPerUser} />
                  <MetricCard
                    label="Crescimento semanal"
                    value={`${stats.launches.weekGrowth > 0 ? '↑' : stats.launches.weekGrowth < 0 ? '↓' : '—'} ${Math.abs(stats.launches.weekGrowth)}%`}
                    color={stats.launches.weekGrowth >= 0 ? 'var(--green)' : 'var(--red)'}
                  />
                  <MetricCard
                    label="Dia mais ativo"
                    value={DAYS[stats.launches.byDayOfWeek.indexOf(Math.max(...stats.launches.byDayOfWeek))]}
                  />
                </div>

                {/* Row 4 — Saúde / Churn */}
                <SectionTitle>Saúde</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Nunca lançaram */}
                  <div style={{
                    background: stats.users.neverLaunched > 5 ? 'var(--red-bg)' : 'var(--surface)',
                    borderRadius: 'var(--r)', padding: 20, border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Nunca lançaram</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: stats.users.neverLaunched > 5 ? 'var(--red)' : 'var(--text)' }}>
                      {stats.users.neverLaunched}
                    </div>
                    {stats.churn.neverLaunched.length > 0 && (
                      <button onClick={() => setNeverExpanded(v => !v)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                        color: 'var(--accent)', padding: 0, marginTop: 8,
                      }}>
                        {neverExpanded ? 'Ocultar lista ▲' : 'Ver lista ▼'}
                      </button>
                    )}
                    {neverExpanded && (
                      <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                        {stats.churn.neverLaunched.map(u => (
                          <div key={u.user_id} style={{ fontSize: 12, color: 'var(--text-2)', padding: '2px 0', borderBottom: '1px solid var(--border-2)' }}>
                            {u.email} <span style={{ color: 'var(--text-3)' }}>({fmt(u.created_at)})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Risco de churn */}
                  <div style={{
                    background: stats.users.inactiveRisk > 3 ? '#FFF8E6' : 'var(--surface)',
                    borderRadius: 'var(--r)', padding: 20, border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Risco de churn (7+ dias sem lançar)</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: stats.users.inactiveRisk > 3 ? 'var(--yellow)' : 'var(--text)' }}>
                      {stats.users.inactiveRisk}
                    </div>
                    {stats.churn.inactiveRisk.length > 0 && (
                      <button onClick={() => setRiskExpanded(v => !v)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                        color: 'var(--accent)', padding: 0, marginTop: 8,
                      }}>
                        {riskExpanded ? 'Ocultar lista ▲' : 'Ver lista ▼'}
                      </button>
                    )}
                    {riskExpanded && (
                      <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                        {stats.churn.inactiveRisk.map(u => (
                          <div key={u.user_id} style={{ fontSize: 12, color: 'var(--text-2)', padding: '2px 0', borderBottom: '1px solid var(--border-2)' }}>
                            {u.email}
                            <span style={{ color: 'var(--text-3)' }}> — último: {fmt(u.lastLaunch)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--red)' }}>Erro ao carregar métricas.</p>
            )}
          </>
        )}

        {/* ── SEÇÃO 2: USUÁRIOS ── */}
        {tab === 'users' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Usuários</h1>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setInviteOpen(true)} style={{
                  padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
                }}>+ Convidar usuário</button>
                <a href="/api/admin/export" download style={{
                  padding: '10px 18px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                }}>↓ Exportar CSV</a>
              </div>
            </div>

            {/* Barra de busca + filtros */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                type="text" placeholder="Buscar por e-mail…" value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                style={{
                  padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                  background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit', flex: 1, minWidth: 200,
                }}
              />
              <select value={userFilter} onChange={e => { setUserFilter(e.target.value); setUserPage(1); }} style={{
                padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
              }}>
                <option value="all">Todos</option>
                <option value="confirmed">Confirmados</option>
                <option value="unconfirmed">Não confirmados</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="blocked">Bloqueados</option>
              </select>
              <select value={userOrder} onChange={e => { setUserOrder(e.target.value); setUserPage(1); }} style={{
                padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
              }}>
                <option value="created_at">Cadastro</option>
                <option value="last_sign_in_at">Último acesso</option>
                <option value="launches">Lançamentos</option>
              </select>
              <button onClick={fetchUsers} style={{
                padding: '10px 14px', background: 'var(--accent-bg)', color: 'var(--accent)', border: 'none',
                borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
              }}>Buscar</button>
            </div>

            {/* Tabela */}
            <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['E-mail', 'Cadastro', 'Último acesso', 'Lançamentos', 'Plano', 'Status', 'Ações'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Carregando…</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Nenhum usuário encontrado.</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-2)' }}>
                      <td style={{ padding: '10px 14px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{fmt(u.created_at)}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{fmt(u.last_sign_in_at)}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{u.launches_count}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <PlanBadge plan={u.plan} billingCycle={u.billing_cycle} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {u.is_blocked
                          ? <Chip label="Bloqueado" color="#c0392b" bg="var(--red-bg)" />
                          : u.email_confirmed_at
                            ? <Chip label="Confirmado" color="var(--green-text)" bg="var(--green-bg)" />
                            : <Chip label="Não confirmado" color="var(--yellow-text)" bg="var(--yellow-bg)" />
                        }
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openDetail(u.id)} style={btnStyle}>Detalhes</button>
                        <button onClick={() => toggleBlock(u)} style={{ ...btnStyle, color: u.is_blocked ? 'var(--green)' : 'var(--yellow-text)' }}>
                          {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button onClick={() => setConfirmDelete(u.id)} style={{ ...btnStyle, color: 'var(--red)' }}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, alignItems: 'center', fontSize: 14 }}>
              <button disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)} style={pageBtn}>← Anterior</button>
              <span style={{ color: 'var(--text-2)' }}>
                Página {userPage} de {Math.max(1, Math.ceil(usersTotal / 20))} ({usersTotal} usuários)
              </span>
              <button disabled={userPage >= Math.ceil(usersTotal / 20)} onClick={() => setUserPage(p => p + 1)} style={pageBtn}>Próxima →</button>
            </div>
          </>
        )}

        {/* ── SEÇÃO 3: GRÁFICO ── */}
        {tab === 'growth' && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 24px' }}>Atividade por dia da semana</h1>
            {loadingStats ? (
              <p style={{ color: 'var(--text-3)' }}>Carregando…</p>
            ) : (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: 24, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                  Distribuição de lançamentos por dia da semana (total histórico)
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: 'var(--text-2)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-2)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                    />
                    <Line type="monotone" dataKey="lançamentos" stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: 'var(--accent)', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Modal: Detalhes do usuário ── */}
      {detailUser && (
        <Modal onClose={() => setDetailUser(null)}>
          <h2 style={{ margin: '0 0 16px', fontWeight: 900, fontSize: 18 }}>Detalhes do usuário</h2>
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
          <h3 style={{ margin: '24px 0 12px', fontWeight: 800, fontSize: 15 }}>Plano e Assinatura</h3>
          {subLoading ? (
            <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>Carregando assinatura…</p>
          ) : subscription ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, borderBottom: '1px solid var(--border-2)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-2)' }}>Plano atual</span>
                  <PlanBadge plan={subscription.plan} billingCycle={subscription.billing_cycle} />
                </div>
                <Row label="Status" value={subscription.status} />
                <Row label="Ciclo de cobrança" value={subscription.billing_cycle ?? '—'} />
                <Row label="Vence em" value={fmt(subscription.current_period_end)} />
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
            <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>Sem dados de assinatura.</p>
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
              padding: '10px 18px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, marginLeft: 'auto',
            }}>Fechar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Convidar usuário ── */}
      {inviteOpen && (
        <Modal onClose={() => { setInviteOpen(false); setInviteMsg(''); }}>
          <h2 style={{ margin: '0 0 16px', fontWeight: 900, fontSize: 18 }}>Convidar usuário</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              E-mail *
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
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
                padding: '10px 18px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)',
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
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '0 0 20px' }}>
            Tem certeza? Esta ação é irreversível. Todos os dados do usuário serão excluídos permanentemente.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => deleteUser(confirmDelete)} style={{
              padding: '10px 18px', background: 'var(--red)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>Sim, excluir</button>
            <button onClick={() => setConfirmDelete(null)} style={{
              padding: '10px 18px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Conceder Pro ── */}
      {grantOpen && detailUser && (
        <Modal onClose={() => setGrantOpen(false)}>
          <h2 style={{ margin: '0 0 12px', fontWeight: 900, fontSize: 18 }}>Conceder Pro</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '0 0 16px' }}>
            Conceder plano Pro manualmente para <strong>{detailUser.email}</strong>.
          </p>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block' }}>
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
              padding: '10px 18px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Confirmar revogação Pro ── */}
      {confirmRevoke && detailUser && (
        <Modal onClose={() => setConfirmRevoke(false)}>
          <h2 style={{ margin: '0 0 12px', fontWeight: 900, fontSize: 18, color: 'var(--red)' }}>Revogar Pro</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '0 0 20px' }}>
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
              padding: '10px 18px', background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)',
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
          .admin-main { margin-left: 0 !important; padding: 20px 16px !important; }
          .admin-mobile-tabs { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Estilos helper ─────────────────────────────────────────────────────── */

const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
  fontWeight: 700, color: 'var(--accent)', padding: '4px 6px', fontFamily: 'inherit',
};

const pageBtn: React.CSSProperties = {
  padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid var(--border-2)', paddingBottom: 8 }}>
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
