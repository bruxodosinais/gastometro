import { fmtDateTime } from './utils';
import type { PushHistoryItem, PushTarget, StatusMessage } from './types';

interface Props {
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
  pushHistory: PushHistoryItem[];
  pushHistoryLoading: boolean;
  onSendPushManual: () => void;
}

export function AdminNotificacoes({
  pushTitle, setPushTitle,
  pushMessage, setPushMessage,
  pushUrl, setPushUrl,
  pushTarget, setPushTarget,
  pushSending, pushResult,
  pushHistory, pushHistoryLoading,
  onSendPushManual,
}: Props) {
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 24px', color: '#111827' }}>Notificações</h1>

      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r)', padding: 20,
        border: '1px solid var(--border)', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px', color: '#111827' }}>Enviar push manual</h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
          Envia um push instantâneo para os usuários selecionados que tenham notificações ativadas.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            Título * <span style={{ fontWeight: 500, color: '#6b7280' }}>({pushTitle.length}/50)</span>
            <input
              type="text" value={pushTitle} maxLength={50}
              onChange={e => setPushTitle(e.target.value)}
              placeholder="🎉 Nova feature disponível"
              style={{
                display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14,
              }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            Mensagem * <span style={{ fontWeight: 500, color: '#6b7280' }}>({pushMessage.length}/120)</span>
            <textarea
              value={pushMessage} maxLength={120}
              onChange={e => setPushMessage(e.target.value)}
              placeholder="Texto curto, direto ao ponto."
              rows={3}
              style={{
                display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14, resize: 'vertical',
              }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            URL de destino (opcional)
            <input
              type="text" value={pushUrl}
              onChange={e => setPushUrl(e.target.value)}
              placeholder="/ (padrão)"
              style={{
                display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14,
              }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            Destinatários
            <select
              value={pushTarget}
              onChange={e => setPushTarget(e.target.value as PushTarget)}
              style={{
                display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                background: 'var(--surface)', fontFamily: 'inherit', fontSize: 14,
              }}
            >
              <option value="all">Todos</option>
              <option value="pro">Só Pro</option>
              <option value="free">Só Free</option>
            </select>
          </label>
          {pushResult && (
            <p style={{
              margin: 0, fontSize: 13,
              color: pushResult.kind === 'success' ? 'var(--green)' : 'var(--red)',
            }}>{pushResult.text}</p>
          )}
          <div>
            <button
              onClick={onSendPushManual}
              disabled={pushSending || !pushTitle.trim() || !pushMessage.trim()}
              style={{
                padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 700, fontSize: 14,
                opacity: pushSending || !pushTitle.trim() || !pushMessage.trim() ? 0.6 : 1,
              }}
            >
              {pushSending ? 'Enviando…' : 'Enviar push'}
            </button>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px', color: '#111827' }}>Histórico</h2>
      <div style={{
        overflowX: 'auto', background: 'var(--surface)', borderRadius: 'var(--r)',
        border: '1px solid var(--border)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Data', 'Título', 'Destinatários', 'Enviados', 'Falhas'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '12px 14px', fontWeight: 700,
                  color: '#374151', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pushHistoryLoading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Carregando…</td></tr>
            ) : pushHistory.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Nenhum push enviado ainda.</td></tr>
            ) : pushHistory.map(h => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--border-2)' }}>
                <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDateTime(h.created_at)}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#111827' }}>{h.title}</td>
                <td style={{ padding: '10px 14px', color: '#111827' }}>
                  <code style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, color: '#111827' }}>
                    {h.target}
                  </code>
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--green)', fontWeight: 700 }}>{h.sent_count}</td>
                <td style={{
                  padding: '10px 14px', fontWeight: 700,
                  color: h.failed_count > 0 ? 'var(--red)' : '#6b7280',
                }}>{h.failed_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
