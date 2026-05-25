'use client';

import { useState } from 'react';
import { fmtDateTime } from './utils';
import type {
  EmailSegment, PushHistoryItem, PushTarget, StatusMessage,
} from './types';

// ───── Design tokens ─────
const C = {
  card: '#FFFFFF',
  primary: '#5B5BD6',
  success: '#00C37A',
  danger: '#FF4757',
  text: '#1A1A1A',
  text2: '#6B6B6B',
  text3: '#9CA3AF',
  border: '#E5E5E0',
  borderLight: '#F0F0EC',
};

const SEGMENT_OPTIONS: { value: EmailSegment; label: string }[] = [
  { value: 'all', label: 'Todos os usuários' },
  { value: 'pro', label: 'Usuários Pro' },
  { value: 'free', label: 'Usuários Free' },
  { value: 'never_launched', label: 'Nunca lançaram' },
  { value: 'inactive', label: 'Risco de churn (7+ dias)' },
];

const PUSH_TARGET_OPTIONS: { value: PushTarget; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pro', label: 'Só Pro' },
  { value: 'free', label: 'Só Free' },
];

interface Props {
  // E-mail em massa
  emailSegment: EmailSegment;
  setEmailSegment: (v: EmailSegment) => void;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  emailMessage: string;
  setEmailMessage: (v: string) => void;
  emailSending: boolean;
  emailResult: StatusMessage | null;
  onSendBulkEmail: () => void;

  // Push manual
  pushTitle: string;
  setPushTitle: (v: string) => void;
  pushMessage: string;
  setPushMessage: (v: string) => void;
  pushUrl: string;
  setPushUrl: (v: string) => void;
  pushTarget: PushTarget;
  setPushTarget: (v: PushTarget) => void;
  pushSending: boolean;
  pushResult: StatusMessage | null;
  onSendPushManual: () => void;

  // Histórico
  pushHistory: PushHistoryItem[];
  pushHistoryLoading: boolean;
}

export function AdminComunicacao({
  emailSegment, setEmailSegment,
  emailSubject, setEmailSubject,
  emailMessage, setEmailMessage,
  emailSending, emailResult,
  onSendBulkEmail,
  pushTitle, setPushTitle,
  pushMessage, setPushMessage,
  pushUrl, setPushUrl,
  pushTarget, setPushTarget,
  pushSending, pushResult,
  onSendPushManual,
  pushHistory, pushHistoryLoading,
}: Props) {
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px', color: C.text }}>
        Comunicação
      </h1>
      <p style={{ fontSize: 13, color: C.text2, margin: '0 0 20px' }}>
        Envio em massa e histórico — mantém usuários informados sem sair do admin.
      </p>

      <EmailSection
        segment={emailSegment} setSegment={setEmailSegment}
        subject={emailSubject} setSubject={setEmailSubject}
        message={emailMessage} setMessage={setEmailMessage}
        sending={emailSending} result={emailResult}
        onSend={onSendBulkEmail}
      />

      <PushSection
        title={pushTitle} setTitle={setPushTitle}
        message={pushMessage} setMessage={setPushMessage}
        url={pushUrl} setUrl={setPushUrl}
        target={pushTarget} setTarget={setPushTarget}
        sending={pushSending} result={pushResult}
        onSend={onSendPushManual}
      />

      <HistorySection
        pushHistory={pushHistory}
        pushHistoryLoading={pushHistoryLoading}
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Seção 1 — E-mail em massa
// ──────────────────────────────────────────────────────────────
function EmailSection({
  segment, setSegment, subject, setSubject, message, setMessage,
  sending, result, onSend,
}: {
  segment: EmailSegment; setSegment: (v: EmailSegment) => void;
  subject: string; setSubject: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  sending: boolean; result: StatusMessage | null;
  onSend: () => void;
}) {
  const canSend = !sending && subject.trim().length > 0 && message.trim().length > 0;
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 22 }}>📧</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: C.text }}>
          E-mail em massa
        </h2>
      </div>
      <p style={{ fontSize: 13, color: C.text2, margin: '0 0 16px' }}>
        Envie para um segmento de usuários via Resend. Limite de 50/envio.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Destinatários">
          <select
            value={segment}
            onChange={e => setSegment(e.target.value as EmailSegment)}
            style={inputStyle}
          >
            {SEGMENT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Assunto *">
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Assunto do e-mail"
            style={inputStyle}
          />
        </Field>

        <Field label="Mensagem *">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Corpo do e-mail (texto simples)"
            rows={6}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <button
          onClick={onSend}
          disabled={!canSend}
          style={{
            ...primaryButtonStyle,
            width: '100%',
            opacity: canSend ? 1 : 0.6,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? 'Enviando…' : 'Enviar e-mail'}
        </button>

        {result && (
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 600,
            color: result.kind === 'success' ? C.success : C.danger,
          }}>
            {result.text}
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Seção 2 — Push manual
// ──────────────────────────────────────────────────────────────
function PushSection({
  title, setTitle, message, setMessage, url, setUrl, target, setTarget,
  sending, result, onSend,
}: {
  title: string; setTitle: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  url: string; setUrl: (v: string) => void;
  target: PushTarget; setTarget: (v: PushTarget) => void;
  sending: boolean; result: StatusMessage | null;
  onSend: () => void;
}) {
  const canSend = !sending && title.trim().length > 0 && message.trim().length > 0;
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 22 }}>🔔</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: C.text }}>
          Push manual
        </h2>
      </div>
      <p style={{ fontSize: 13, color: C.text2, margin: '0 0 16px' }}>
        Push instantâneo para usuários do segmento que ativaram notificações.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={`Título * (${title.length}/50)`}>
          <input
            type="text"
            value={title}
            maxLength={50}
            onChange={e => setTitle(e.target.value)}
            placeholder="🎉 Nova feature disponível"
            style={inputStyle}
          />
        </Field>

        <Field label={`Mensagem * (${message.length}/120)`}>
          <textarea
            value={message}
            maxLength={120}
            onChange={e => setMessage(e.target.value)}
            placeholder="Texto curto, direto ao ponto."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <Field label="URL de destino (opcional)">
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="/ (padrão)"
            style={inputStyle}
          />
        </Field>

        <Field label="Destinatários">
          <select
            value={target}
            onChange={e => setTarget(e.target.value as PushTarget)}
            style={inputStyle}
          >
            {PUSH_TARGET_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>

        <button
          onClick={onSend}
          disabled={!canSend}
          style={{
            ...primaryButtonStyle,
            width: '100%',
            opacity: canSend ? 1 : 0.6,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? 'Enviando…' : 'Enviar push'}
        </button>

        {result && (
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 600,
            color: result.kind === 'success' ? C.success : C.danger,
          }}>
            {result.text}
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Seção 3 — Histórico (tabs: e-mails / pushes)
// ──────────────────────────────────────────────────────────────
type HistoryTab = 'emails' | 'pushes';

function HistorySection({
  pushHistory, pushHistoryLoading,
}: {
  pushHistory: PushHistoryItem[];
  pushHistoryLoading: boolean;
}) {
  const [tab, setTab] = useState<HistoryTab>('pushes');

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: C.text }}>
        Histórico de comunicações
      </h2>
      <p style={{ fontSize: 13, color: C.text2, margin: '0 0 16px' }}>
        Últimos envios pelo admin.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: `1px solid ${C.borderLight}` }}>
        <HistoryTabButton active={tab === 'emails'} onClick={() => setTab('emails')}>
          E-mails enviados
        </HistoryTabButton>
        <HistoryTabButton active={tab === 'pushes'} onClick={() => setTab('pushes')}>
          Pushes enviados
        </HistoryTabButton>
      </div>

      {tab === 'emails' ? (
        <EmailHistory />
      ) : (
        <PushHistory items={pushHistory} loading={pushHistoryLoading} />
      )}
    </div>
  );
}

function HistoryTabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', padding: '10px 14px',
        marginBottom: -1, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 14, fontWeight: 700,
        color: active ? C.primary : C.text2,
        borderBottom: active ? `2px solid ${C.primary}` : '2px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

function EmailHistory() {
  // Sem tabela de histórico de e-mails no banco — estado vazio.
  return (
    <div style={{
      padding: '32px 16px', textAlign: 'center', color: C.text3,
      fontSize: 13,
    }}>
      Nenhum e-mail enviado ainda.
    </div>
  );
}

function PushHistory({
  items, loading,
}: { items: PushHistoryItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: C.text3, fontSize: 13 }}>
        Carregando…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: C.text3, fontSize: 13 }}>
        Nenhum push enviado ainda.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}` }}>
            <th style={thStyle}>Data</th>
            <th style={thStyle}>Título</th>
            <th style={thStyle}>Segmento</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Enviados</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Falhas</th>
          </tr>
        </thead>
        <tbody>
          {items.map(h => (
            <tr key={h.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              <td style={{ ...tdStyle, color: C.text2, whiteSpace: 'nowrap' }}>
                {fmtDateTime(h.created_at)}
              </td>
              <td style={{ ...tdStyle, fontWeight: 700 }}>{h.title}</td>
              <td style={tdStyle}>
                <code style={{
                  fontSize: 12, background: C.borderLight,
                  padding: '2px 6px', borderRadius: 4,
                }}>
                  {h.target}
                </code>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: C.success, fontWeight: 700 }}>
                {h.sent_count}
              </td>
              <td style={{
                ...tdStyle, textAlign: 'right', fontWeight: 700,
                color: h.failed_count > 0 ? C.danger : C.text3,
              }}>
                {h.failed_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Auxiliares de form / estilo
// ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.text }}>
      {label}
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}

const cardStyle: React.CSSProperties = {
  background: C.card,
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: C.card,
  fontFamily: 'inherit',
  fontSize: 14,
  color: C.text,
  boxSizing: 'border-box',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 18px',
  background: C.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontWeight: 700,
  color: C.text2,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: C.text,
};
