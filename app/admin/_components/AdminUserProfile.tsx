'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Engagement, TimelineKind, UserInsights } from '@/lib/adminUserInsights';
import { Chip, MetricCard, Modal, PlanBadge, Row, SectionTitle, platformLabel } from './shared';
import { DAYS, fmt, fmtBRL, fmtDateTime, fmtRelative } from './utils';
import type { StatusMessage } from './types';

// Raio-X de um usuário. Os dados vêm prontos de /api/admin/users/[id]/insights
// (lib/adminUserInsights.ts); aqui só tem apresentação e a "leitura rápida",
// que traduz os números em frases.

const ENGAGEMENT: Record<Engagement, { label: string; color: string; bg: string }> = {
  unconfirmed: { label: 'Não confirmou o e-mail', color: 'var(--yellow-text)', bg: 'var(--yellow-bg)' },
  never_launched: { label: 'Nunca lançou', color: '#92400e', bg: '#FEF3C7' },
  active: { label: 'Ativo', color: 'var(--green-text)', bg: 'var(--green-bg)' },
  cooling: { label: 'Esfriando', color: '#92400e', bg: '#FEF3C7' },
  lost: { label: 'Sumiu', color: '#c0392b', bg: 'var(--red-bg)' },
};

const KIND_META: Record<TimelineKind, { icon: string; label: string }> = {
  account: { icon: '👤', label: 'Conta' },
  onboarding: { icon: '🚪', label: 'Onboarding' },
  launch: { icon: '🧾', label: 'Lançamentos' },
  goal: { icon: '🎯', label: 'Metas' },
  mission: { icon: '🐷', label: 'Missão' },
  subscription: { icon: '💳', label: 'Assinatura' },
  feedback: { icon: '💬', label: 'Feedback' },
  email: { icon: '✉️', label: 'E-mails' },
  push: { icon: '🔔', label: 'Push' },
  reward: { icon: '🏅', label: 'Conquistas' },
  setup: { icon: '⚙️', label: 'Configuração' },
};

const ACTION_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  view: { label: 'viu', color: '#374151', bg: '#E5E7EB' },
  complete: { label: 'concluiu', color: 'var(--green-text)', bg: 'var(--green-bg)' },
  skip: { label: 'pulou', color: '#92400e', bg: '#FEF3C7' },
  back: { label: 'voltou', color: '#3730a3', bg: '#E0E7FF' },
  deny: { label: 'recusou', color: '#c0392b', bg: 'var(--red-bg)' },
};

const card: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 'var(--r)', padding: 20,
  border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)',
};

const actionBtn: React.CSSProperties = {
  padding: '9px 16px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, background: 'var(--surface)',
};

type Tone = 'good' | 'bad' | 'neutral';
interface Signal { tone: Tone; text: string }

/** Frases da "leitura rápida". Cada regra só fala quando tem dado para isso. */
function readSignals(i: UserInsights): Signal[] {
  const out: Signal[] = [];
  const { engagement: e, launches: l, subscription: s, account: a, setup, mission, onboarding } = i;

  if (s.paying) {
    out.push({ tone: 'good', text: s.days_to_pay === 0 ? 'Assinou no mesmo dia do cadastro.' : `Assinou ${s.days_to_pay} dia(s) depois do cadastro.` });
    if (e.status === 'lost' || e.status === 'cooling') {
      out.push({
        tone: 'bad',
        text: `Pagante sem aparecer há ${e.days_since_seen} dias — risco de não renovar${s.current_period_end ? ` em ${fmt(s.current_period_end)}` : ''}.`,
      });
    }
  }

  if (e.status === 'unconfirmed') out.push({ tone: 'bad', text: 'Criou a conta e não confirmou o e-mail.' });
  if (e.status === 'never_launched' && a.email_confirmed_at) out.push({ tone: 'bad', text: 'Confirmou o e-mail mas nunca registrou um lançamento.' });

  if (e.d1 === true) out.push({ tone: 'good', text: 'Voltou no dia seguinte ao cadastro (D1).' });
  if (e.d1 === false) out.push({ tone: 'bad', text: 'Não voltou no dia seguinte ao cadastro (D1).' });
  if (e.d7 === true) out.push({ tone: 'good', text: 'Estava usando uma semana depois (D7).' });

  if (l.manual > 0) {
    if (l.hours_to_first !== null) {
      out.push({ tone: 'neutral', text: l.hours_to_first < 1 ? 'Fez o 1º lançamento na primeira hora.' : `1º lançamento ${l.hours_to_first}h depois do cadastro.` });
    }
    if (l.same_day_pct !== null && l.median_lag_days !== null) {
      out.push(l.same_day_pct >= 60
        ? { tone: 'good', text: `Registra na hora: ${l.same_day_pct}% dos gastos no mesmo dia em que aconteceram.` }
        : { tone: 'neutral', text: `Registra em lote: só ${l.same_day_pct}% no mesmo dia; mediana de ${l.median_lag_days} dia(s) de atraso (passou histórico para o app).` });
    }
    const peakHour = l.by_hour.indexOf(Math.max(...l.by_hour));
    const peakDay = l.by_weekday.indexOf(Math.max(...l.by_weekday));
    out.push({ tone: 'neutral', text: `Costuma registrar por volta das ${peakHour}h, mais aos ${DAYS[peakDay].toLowerCase()}.` });
    if (l.distinct_days > 0 && l.avg_per_launch_day >= 10) {
      out.push({ tone: 'neutral', text: `Média de ${l.avg_per_launch_day} lançamentos por dia em que usa — sessões longas e espaçadas.` });
    }
  }

  if (mission) {
    if (mission.contributions === 0) out.push({ tone: 'bad', text: `Tem a missão "${mission.name}" mas nunca guardou dinheiro nela.` });
    else out.push({ tone: 'good', text: `Já guardou ${fmtBRL(mission.contributed)} em ${mission.contributions} aporte(s) na missão.` });
  } else if (e.status !== 'unconfirmed') {
    out.push({ tone: 'neutral', text: 'Não tem missão de poupança.' });
  }

  const skippedAll = onboarding.events.some(ev => ev.step === 'onb_welcome' && ev.action === 'skip');
  if (skippedAll) out.push({ tone: 'bad', text: 'Pulou o onboarding inteiro na tela de boas-vindas.' });
  const sawPaywall = onboarding.events.some(ev => ev.step === 'paywall_view');
  const subscribedPaywall = onboarding.events.some(ev => ev.step === 'paywall_subscribe');
  if (sawPaywall && !subscribedPaywall && !s.paying) out.push({ tone: 'neutral', text: 'Viu o paywall no começo e não assinou.' });

  if (!a.push.ios && !a.push.android && !a.push.web) out.push({ tone: 'bad', text: 'Nunca ativou notificações — só volta ao app por conta própria.' });
  if (setup.recurring_active === 0 && e.status !== 'unconfirmed') out.push({ tone: 'neutral', text: 'Não cadastrou contas fixas nem renda recorrente.' });

  return out;
}

export function AdminUserProfile({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<UserInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [msg, setMsg] = useState<StatusMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantDays, setGrantDays] = useState(30);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [kindFilter, setKindFilter] = useState<'all' | TimelineKind>('all');
  const [timelineVisible, setTimelineVisible] = useState(30);
  const [journeyOpen, setJourneyOpen] = useState(false);

  // Sem setState síncrono: `loading` só importa na 1ª carga (depois a tela
  // mantém os dados antigos enquanto recarrega após uma ação).
  const load = useCallback(() => {
    fetch(`/api/admin/users/${id}/insights`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Erro ao carregar.');
        setData(d);
        setError('');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const signals = useMemo(() => (data ? readSignals(data) : []), [data]);

  async function call(url: string, init: RequestInit, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, init);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) throw new Error(d.error ?? 'Erro.');
      setMsg({ kind: 'success', text: ok });
      load();
      return true;
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Erro.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href="/admin?tab=users" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
      ← Usuários
    </Link>
  );

  if (loading && !data) return <>{back}<p style={{ color: '#6b7280', marginTop: 24 }}>Carregando…</p></>;
  if (error || !data) return <>{back}<p style={{ color: 'var(--red)', marginTop: 24 }}>{error || 'Usuário não encontrado.'}</p></>;

  const { account: a, engagement: e, launches: l, subscription: s } = data;
  const eng = ENGAGEMENT[e.status];
  const timeline = kindFilter === 'all' ? data.timeline : data.timeline.filter(t => t.kind === kindFilter);
  const kindsPresent = [...new Set(data.timeline.map(t => t.kind))];

  return (
    <>
      {back}

      {/* ── Cabeçalho ── */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#111827', wordBreak: 'break-word' }}>
              {a.name || a.email}
            </h1>
            {a.name && <div style={{ color: '#6b7280', fontSize: 14, marginTop: 2, wordBreak: 'break-all' }}>{a.email}</div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <Chip label={eng.label} color={eng.color} bg={eng.bg} />
              <PlanBadge plan={s.plan} billingCycle={s.billing_cycle} store={s.store} />
              {!a.real_cohort && <Chip label="Pré-lançamento" color="#4b5563" bg="#E5E7EB" />}
              {a.is_blocked && <Chip label="Bloqueado" color="#c0392b" bg="var(--red-bg)" />}
            </div>
            <div style={{ color: '#374151', fontSize: 13, marginTop: 10 }}>
              Conta criada {fmtRelative(a.created_at)} ({fmt(a.created_at)}) · começou pelo <strong>{platformLabel(a.signup_platform)}</strong>
              {' · '}visto por último <strong>{e.last_seen ? fmtRelative(`${e.last_seen}T12:00:00-03:00`) : 'nunca'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {s.plan !== 'pro' && (
              <button disabled={busy} onClick={() => { setGrantDays(30); setGrantOpen(true); }}
                style={{ ...actionBtn, background: '#FFF4CC', color: '#7a5d00', borderColor: '#f0d97a' }}>
                Conceder Pro
              </button>
            )}
            {s.plan === 'pro' && s.billing_cycle === 'manual' && (
              <button disabled={busy} onClick={() => setConfirmRevoke(true)} style={{ ...actionBtn, color: 'var(--red)' }}>
                Revogar Pro
              </button>
            )}
            <button disabled={busy} style={{ ...actionBtn, color: a.is_blocked ? 'var(--green)' : 'var(--yellow-text)' }}
              onClick={() => call(`/api/admin/users/${id}/block`, { method: a.is_blocked ? 'DELETE' : 'POST' },
                a.is_blocked ? 'Usuário desbloqueado.' : 'Usuário bloqueado.')}>
              {a.is_blocked ? 'Desbloquear' : 'Bloquear'}
            </button>
            <button disabled={busy} onClick={() => setConfirmDelete(true)}
              style={{ ...actionBtn, background: 'var(--red-bg)', color: 'var(--red)', border: 'none' }}>
              Excluir
            </button>
          </div>
        </div>
        {msg && (
          <p style={{ fontSize: 13, margin: '12px 0 0', color: msg.kind === 'success' ? 'var(--green)' : 'var(--red)' }}>{msg.text}</p>
        )}
      </div>

      {/* ── Leitura rápida ── */}
      {signals.length > 0 && (
        <>
          <SectionTitle>Leitura rápida</SectionTitle>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {signals.map((sig, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#111827', alignItems: 'baseline' }}>
                <span aria-hidden style={{
                  width: 8, height: 8, borderRadius: 999, flexShrink: 0, transform: 'translateY(-1px)',
                  background: sig.tone === 'good' ? 'var(--green)' : sig.tone === 'bad' ? 'var(--red)' : '#9ca3af',
                }} />
                <span>{sig.text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Números ── */}
      <SectionTitle>Uso</SectionTitle>
      <div className="admin-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MetricCard label="Dias ativos" value={e.active_days} sub={`${e.active_last_7} nos últimos 7 · ${e.active_last_30} nos últimos 30`} />
        <MetricCard label="Sequência" value={`${e.current_streak} dia${e.current_streak === 1 ? '' : 's'}`} sub={`maior: ${e.longest_streak}`} />
        <MetricCard label="Lançamentos" value={l.total} sub={`${l.manual} digitados · ${l.automatic} automáticos`} />
        <div style={{ ...card, padding: '20px 20px 16px' }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>Voltou depois do cadastro</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['D1', e.d1], ['D7', e.d7], ['D30', e.d30]] as const).map(([k, v]) => (
              <Chip key={k} label={`${k} ${v === null ? '…' : v ? '✓' : '✗'}`}
                color={v === null ? '#6b7280' : v ? 'var(--green-text)' : '#c0392b'}
                bg={v === null ? '#F3F4F6' : v ? 'var(--green-bg)' : 'var(--red-bg)'} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>… = conta nova demais para medir</div>
        </div>
      </div>

      {/* ── Calendário ── */}
      <SectionTitle>Últimas 12 semanas</SectionTitle>
      <div style={card}>
        <Heatmap calendar={data.calendar} />
      </div>

      {/* ── Como registra ── */}
      <SectionTitle>Como registra</SectionTitle>
      {l.manual === 0 ? (
        <div style={{ ...card, color: '#6b7280', fontSize: 14 }}>Nenhum lançamento digitado ainda.</div>
      ) : (
        <div className="admin-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Hora em que digita (Brasília)</div>
            <Bars values={l.by_hour} labels={l.by_hour.map((_, h) => (h % 3 === 0 ? `${h}h` : ''))} titles={l.by_hour.map((v, h) => `${h}h: ${v}`)} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '20px 0 12px' }}>Dia da semana</div>
            <Bars values={l.by_weekday} labels={DAYS} titles={l.by_weekday.map((v, d) => `${DAYS[d]}: ${v}`)} />
          </div>
          <div style={card}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Gastos / receitas" value={`${l.expenses} / ${l.incomes}`} />
              <Row label="No cartão de crédito" value={String(l.credit)} />
              <Row label="Total de gastos registrados" value={fmtBRL(l.expense_sum)} />
              <Row label="Registrados no mesmo dia do gasto" value={l.same_day_pct === null ? '—' : `${l.same_day_pct}%`} />
              <Row label="Dias com lançamento" value={`${l.distinct_days} (média ${l.avg_per_launch_day}/dia)`} />
              <Row label="1º lançamento" value={l.first_at ? fmtDateTime(l.first_at) : '—'} />
              <Row label="Último lançamento" value={l.last_at ? fmtDateTime(l.last_at) : '—'} />
            </div>
            {l.top_categories.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '18px 0 10px' }}>Categorias mais usadas</div>
                {l.top_categories.map(c => (
                  <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span style={{ color: '#111827' }}>{c.category}</span>
                    <span style={{ color: '#374151' }}><strong>{c.count}</strong> · {fmtBRL(c.sum)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── O que configurou ── */}
      <SectionTitle>O que configurou</SectionTitle>
      <div className="admin-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {([
          ['Renda recorrente', data.setup.recurring_income > 0, `${data.setup.recurring_income}`],
          ['Contas fixas ativas', data.setup.recurring_active > 0, `${data.setup.recurring_active}`],
          ['Cartões', data.setup.cards > 0, `${data.setup.cards}`],
          ['Orçamentos', data.setup.budgets > 0, `${data.setup.budgets}`],
          ['Planejamento do mês', data.setup.monthly_plans > 0, `${data.setup.monthly_plans} mês(es)`],
          ['Missão de poupança', !!data.mission, data.mission?.status ?? ''],
          ['Metas', data.goals.length > 0, `${data.goals.length}`],
          ['Categorias próprias', data.setup.custom_categories > 0, `${data.setup.custom_categories}`],
          ['Patrimônio / dívidas', data.setup.assets + data.setup.liabilities > 0, `${data.setup.assets} / ${data.setup.liabilities}`],
          ['Push', a.push.ios || a.push.android || a.push.web,
            [a.push.ios && 'iOS', a.push.android && 'Android', a.push.web && 'Web'].filter(Boolean).join(', ')],
          ['WhatsApp', a.whatsapp_verified, ''],
          ['GastôBot', data.setup.gastobot_uses > 0, `${data.setup.gastobot_uses} uso(s)`],
        ] as const).map(([label, on, detail]) => (
          <div key={label} style={{
            ...card, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center',
            opacity: on ? 1 : 0.6,
          }}>
            <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{on ? '✅' : '⬜️'} {label}</span>
            {on && detail && <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{detail}</span>}
          </div>
        ))}
      </div>

      {/* ── Missão, metas e gamificação ── */}
      <SectionTitle>Poupança e gamificação</SectionTitle>
      <div className="admin-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Missão de poupança</div>
          {data.mission ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Missão" value={data.mission.name} />
              <Row label="Alvo" value={`${fmtBRL(data.mission.target)}${data.mission.months ? ` em ${data.mission.months} meses` : ''}`} />
              <Row label="Guardar por mês" value={data.mission.monthly_target ? fmtBRL(data.mission.monthly_target) : '—'} />
              <Row label="Já guardou" value={`${fmtBRL(data.mission.contributed)} (${data.mission.contributions} aporte(s))`} />
              <Row label="Desafios da IA" value={`${data.mission.challenges_accepted} aceitos · ${data.mission.challenges_completed} concluídos`} />
              <Row label="Status" value={data.mission.status ?? '—'} />
            </div>
          ) : <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Sem missão.</p>}
          {data.goals.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '18px 0 10px' }}>
                Metas ({data.goal_contributions} contribuição(ões))
              </div>
              {data.goals.map((g, idx) => (
                <div key={idx} style={{ fontSize: 13, padding: '4px 0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{g.emoji} {g.name}</span>
                  <span style={{ color: '#374151' }}>{fmtBRL(g.current)} / {fmtBRL(g.target)}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <div style={card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Moedas (saldo / ganhas)" value={`${data.gamification.coins_balance} / ${data.gamification.coins_earned}`} />
            <Row label="Desafios semanais" value={`${data.gamification.weekly_challenges_completed} de ${data.gamification.weekly_challenges_total}`} />
            <Row label="Marcos de sequência" value={data.gamification.streak_milestones.length ? data.gamification.streak_milestones.map(d => `${d}d`).join(', ') : '—'} />
            <Row label="Conquistas" value={String(data.gamification.badges.length)} />
          </div>
          {data.gamification.coins_by_type.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '18px 0 10px' }}>De onde vieram as moedas</div>
              {data.gamification.coins_by_type.map(c => (
                <div key={c.type} style={{ fontSize: 13, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{c.label}</span>
                  <span style={{ color: '#374151' }}>{c.count}× · {c.amount}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Quiz ── */}
      {data.quiz && (
        <>
          <SectionTitle>O que disse no quiz (antes do cadastro)</SectionTitle>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Maior dor" value={data.quiz.painPoint ?? '—'} />
            <Row label="Objetivo" value={data.quiz.goalName ?? '—'} />
            <Row label="Valor da meta" value={data.quiz.targetAmount !== null ? fmtBRL(data.quiz.targetAmount) : '—'} />
            <Row label="Aporte mensal / prazo" value={`${data.quiz.monthlyTarget !== null ? fmtBRL(data.quiz.monthlyTarget) : '—'} · ${data.quiz.months ?? '—'} meses`} />
            <Row label="Renda informada" value={data.quiz.incomeSkipped ? 'Pulou' : data.quiz.monthlyIncome !== null ? fmtBRL(data.quiz.monthlyIncome) : '—'} />
            {data.quiz.savingsPercent !== null && <Row label="% da renda para guardar" value={`${data.quiz.savingsPercent}%`} />}
          </div>
        </>
      )}

      {/* ── Jornada do onboarding ── */}
      <SectionTitle>Jornada do onboarding</SectionTitle>
      <div style={card}>
        {data.onboarding.events.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
            Sem eventos do funil. {a.onboarding_completed ? 'O onboarding consta como concluído (ou pulado) — ' : ''}
            contas criadas antes da instrumentação (28/08) ou antes do app 1.4 não têm esse registro.
          </p>
        ) : (
          <>
            <div style={{ fontSize: 14, color: '#111827', marginBottom: 12 }}>
              Chegou até: <strong>{data.onboarding.furthest ?? '—'}</strong> · {data.onboarding.events.length} eventos
            </div>
            {(journeyOpen ? data.onboarding.events : data.onboarding.events.slice(0, 12)).map((ev, idx) => {
              const act = ACTION_LABEL[ev.action] ?? { label: ev.action, color: '#374151', bg: '#E5E7EB' };
              return (
                <div key={idx} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border-2)', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', width: 110, flexShrink: 0 }}>{fmtDateTime(ev.at)}</span>
                  <span style={{ flex: 1, color: '#111827' }}>{ev.label}</span>
                  <Chip label={act.label} color={act.color} bg={act.bg} />
                  <span style={{ color: '#9ca3af', width: 56, textAlign: 'right' }}>{ev.platform ?? ''}</span>
                </div>
              );
            })}
            {data.onboarding.events.length > 12 && (
              <button onClick={() => setJourneyOpen(o => !o)} style={{ ...actionBtn, marginTop: 12 }}>
                {journeyOpen ? 'Mostrar menos' : `Ver os ${data.onboarding.events.length} eventos`}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Linha do tempo ── */}
      <SectionTitle>Linha do tempo</SectionTitle>
      <div style={card}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {(['all', ...kindsPresent] as const).map(k => (
            <button key={k} onClick={() => { setKindFilter(k); setTimelineVisible(30); }} style={{
              ...actionBtn, padding: '6px 12px', fontSize: 12,
              background: kindFilter === k ? 'var(--accent-bg)' : 'var(--surface)',
              color: kindFilter === k ? 'var(--accent)' : '#374151',
            }}>
              {k === 'all' ? 'Tudo' : `${KIND_META[k].icon} ${KIND_META[k].label}`}
            </button>
          ))}
        </div>
        {timeline.slice(0, timelineVisible).map((t, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-2)', fontSize: 13 }}>
            <span aria-hidden style={{ width: 20, flexShrink: 0 }}>{KIND_META[t.kind].icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#111827', fontWeight: 600 }}>{t.title}</div>
              {t.detail && <div style={{ color: '#6b7280', overflowWrap: 'anywhere' }}>{t.detail}</div>}
            </div>
            <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }} title={t.at}>{fmtDateTime(t.at)}</span>
          </div>
        ))}
        {timeline.length > timelineVisible && (
          <button onClick={() => setTimelineVisible(v => v + 50)} style={{ ...actionBtn, marginTop: 12 }}>
            Ver mais ({timeline.length - timelineVisible})
          </button>
        )}
      </div>

      {/* ── Comunicação + feedback ── */}
      <SectionTitle>O que recebeu e o que disse</SectionTitle>
      <div className="admin-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>E-mails do funil</div>
          {data.communication.emails.length === 0
            ? <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Nenhum.</p>
            : data.communication.emails.map((m, idx) => (
              <div key={idx} style={{ fontSize: 13, padding: '4px 0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{m.label}</span><span style={{ color: '#6b7280' }}>{fmt(m.at)}</span>
              </div>
            ))}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '18px 0 10px' }}>
            Pushes automáticos ({data.communication.push_total})
          </div>
          {data.communication.pushes_by_type.length === 0
            ? <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Nenhum.</p>
            : data.communication.pushes_by_type.map(p => (
              <div key={p.type} style={{ fontSize: 13, padding: '4px 0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{p.label} · {p.count}×</span><span style={{ color: '#6b7280' }}>último {fmt(p.last_at)}</span>
              </div>
            ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Feedback enviado</div>
          {data.feedback.length === 0
            ? <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Nenhum.</p>
            : data.feedback.map((f, idx) => (
              <div key={idx} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border-2)' }}>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{f.category} · {fmtDateTime(f.created_at)}{f.page ? ` · ${f.page}` : ''}</div>
                <div style={{ color: '#111827', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.message}</div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Últimos lançamentos ── */}
      {l.recent.length > 0 && (
        <>
          <SectionTitle>Últimos lançamentos</SectionTitle>
          <p style={{ color: '#6b7280', fontSize: 12, margin: '-8px 0 10px' }}>
            Sem a descrição (texto livre digitado pela pessoa) — só o necessário para ler o comportamento.
          </p>
          <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Digitado em', 'Data do gasto', 'Categoria', 'Valor', 'Origem'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {l.recent.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-2)' }}>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>{fmt(`${r.date.slice(0, 10)}T12:00:00-03:00`)}</td>
                    <td style={{ padding: '8px 14px' }}>{r.category}{r.is_credit ? ' · cartão' : ''}</td>
                    <td style={{ padding: '8px 14px', fontWeight: 700, whiteSpace: 'nowrap', color: r.type === 'income' ? 'var(--green-text)' : '#111827' }}>
                      {r.type === 'income' ? '+' : ''}{fmtBRL(r.amount)}
                    </td>
                    <td style={{ padding: '8px 14px', color: '#6b7280' }}>{r.automatic ? 'automático' : 'digitado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Conta ── */}
      <SectionTitle>Conta</SectionTitle>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Row label="E-mail confirmado" value={a.email_confirmed_at ? fmtDateTime(a.email_confirmed_at) : 'Não'} />
        <Row label="Último login" value={fmtDateTime(a.last_sign_in_at)} />
        <Row label="Onboarding concluído (ou pulado)" value={a.onboarding_completed ? 'Sim' : 'Não'} />
        <Row label="Usa o app" value={[a.app_ios && 'iOS', a.app_android && 'Android'].filter(Boolean).join(' e ') || 'Não identificado'} />
        <Row label="Aceita marketing" value={a.marketing_consent === null ? '—' : a.marketing_consent ? 'Sim' : 'Não'} />
        <Row label="Assinatura" value={s.plan === 'pro' ? `${s.status ?? '—'} · ${s.billing_cycle ?? '—'}${s.current_period_end ? ` · vence ${fmt(s.current_period_end)}` : ''}` : 'Free'} />
        <Row label="ID" value={a.id} />
      </div>

      {/* ── Modais ── */}
      {grantOpen && (
        <Modal onClose={() => setGrantOpen(false)}>
          <h2 style={{ margin: '0 0 12px', fontWeight: 800, fontSize: 18, color: '#111827' }}>Conceder Pro</h2>
          <p style={{ color: '#374151', fontSize: 14, margin: '0 0 16px' }}>
            Conceder plano Pro manualmente para <strong>{a.email}</strong>.
          </p>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', color: '#374151' }}>
            Duração em dias
            <input type="number" min={1} value={grantDays}
              onChange={ev => setGrantDays(Math.max(1, parseInt(ev.target.value) || 1))}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button disabled={busy} onClick={async () => {
              const ok = await call(`/api/admin/users/${id}/subscription`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: grantDays }),
              }, `Pro concedido por ${grantDays} dia(s).`);
              if (ok) setGrantOpen(false);
            }} style={{ ...actionBtn, background: 'var(--accent)', color: '#fff', border: 'none' }}>
              {busy ? 'Concedendo…' : 'Confirmar'}
            </button>
            <button onClick={() => setGrantOpen(false)} style={actionBtn}>Cancelar</button>
          </div>
        </Modal>
      )}

      {confirmRevoke && (
        <Modal onClose={() => setConfirmRevoke(false)}>
          <h2 style={{ margin: '0 0 12px', fontWeight: 900, fontSize: 18, color: 'var(--red)' }}>Revogar Pro</h2>
          <p style={{ color: '#374151', fontSize: 14, margin: '0 0 20px' }}>
            Revogar o Pro de <strong>{a.email}</strong>? A pessoa volta para o Free na hora.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={async () => {
              const ok = await call(`/api/admin/users/${id}/subscription`, { method: 'DELETE' }, 'Pro revogado.');
              if (ok) setConfirmRevoke(false);
            }} style={{ ...actionBtn, background: 'var(--red)', color: '#fff', border: 'none' }}>
              {busy ? 'Revogando…' : 'Sim, revogar'}
            </button>
            <button onClick={() => setConfirmRevoke(false)} style={actionBtn}>Cancelar</button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)}>
          <h2 style={{ margin: '0 0 12px', fontWeight: 900, fontSize: 18, color: 'var(--red)' }}>Excluir usuário</h2>
          <p style={{ color: '#374151', fontSize: 14, margin: '0 0 20px' }}>
            Tem certeza? Esta ação é irreversível. Todos os dados de <strong>{a.email}</strong> serão excluídos permanentemente.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={async () => {
              setBusy(true);
              const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
              setBusy(false);
              if (r.ok) router.push('/admin?tab=users');
              else { setConfirmDelete(false); setMsg({ kind: 'error', text: 'Erro ao excluir usuário.' }); }
            }} style={{ ...actionBtn, background: 'var(--red)', color: '#fff', border: 'none' }}>
              {busy ? 'Excluindo…' : 'Sim, excluir'}
            </button>
            <button onClick={() => setConfirmDelete(false)} style={actionBtn}>Cancelar</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Barras verticais simples (hora do dia / dia da semana). */
function Bars({ values, labels, titles }: { values: number[]; labels: readonly string[]; titles: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
        {values.map((v, idx) => (
          <div key={idx} title={titles[idx]} style={{
            flex: 1, height: `${Math.max(v ? 4 : 1, (v / max) * 100)}%`,
            background: v ? 'var(--accent)' : 'var(--border)', borderRadius: 2,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
        {labels.map((lab, idx) => (
          <div key={idx} style={{ flex: 1, fontSize: 10, color: '#6b7280', textAlign: 'center', overflow: 'visible', whiteSpace: 'nowrap' }}>{lab}</div>
        ))}
      </div>
    </div>
  );
}

/** Mapa de 12 semanas: coluna = semana, linha = dia da semana (dom → sáb). */
function Heatmap({ calendar }: { calendar: UserInsights['calendar'] }) {
  // Alinha a 1ª coluna no domingo para as linhas baterem com o dia da semana.
  const firstDow = new Date(`${calendar[0].day}T12:00:00Z`).getUTCDay();
  const cells: (UserInsights['calendar'][number] | null)[] = [...Array(firstDow).fill(null), ...calendar];
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const maxLaunches = Math.max(1, ...calendar.map(c => c.launches));

  const color = (c: UserInsights['calendar'][number]) => {
    if (c.launches > 0) {
      const t = Math.min(1, 0.3 + (c.launches / maxLaunches) * 0.7);
      return `rgba(91, 91, 214, ${t})`;
    }
    if (c.active) return 'var(--green-bg)';
    return 'var(--border-2)';
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
          {DAYS.map(d => <div key={d} style={{ height: 16, fontSize: 10, color: '#6b7280', lineHeight: '16px' }}>{d}</div>)}
        </div>
        {weeks.map((w, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Array.from({ length: 7 }).map((_, di) => {
              const c = w[di];
              if (!c) return <div key={di} style={{ width: 16, height: 16 }} />;
              return (
                <div key={di}
                  title={`${fmt(`${c.day}T12:00:00-03:00`)} — ${c.launches} lançamento(s)${c.active ? ', abriu o app' : ''}${c.frozen ? ' (congelado)' : ''}`}
                  style={{
                    width: 16, height: 16, borderRadius: 3, background: color(c),
                    outline: c.active && c.launches === 0 ? '1px solid var(--green)' : 'none',
                  }} />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12, color: '#6b7280', flexWrap: 'wrap' }}>
        <span><Swatch bg="rgba(91, 91, 214, 0.8)" /> lançou (mais escuro = mais lançamentos)</span>
        <span><Swatch bg="var(--green-bg)" outline /> só abriu o app</span>
        <span><Swatch bg="var(--border-2)" /> não apareceu</span>
      </div>
    </div>
  );
}

function Swatch({ bg, outline }: { bg: string; outline?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: bg, marginRight: 4,
      verticalAlign: 'middle', outline: outline ? '1px solid var(--green)' : 'none',
    }} />
  );
}
