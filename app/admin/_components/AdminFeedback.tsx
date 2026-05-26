import { Chip } from './shared';
import { FEEDBACK_META, fmtDateTime, initial } from './utils';
import type { FeedbackCategory, FeedbackItem } from './types';

interface Props {
  feedbackItems: FeedbackItem[];
  feedbackUnread: number;
  feedbackLoading: boolean;
  feedbackFilter: 'all' | FeedbackCategory;
  setFeedbackFilter: (v: 'all' | FeedbackCategory) => void;
  onFetchFeedback: () => void;
}

export function AdminFeedback({
  feedbackItems, feedbackUnread, feedbackLoading,
  feedbackFilter, setFeedbackFilter,
  onFetchFeedback,
}: Props) {
  const filteredFeedback = feedbackFilter === 'all'
    ? feedbackItems
    : feedbackItems.filter(f => f.category === feedbackFilter);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
          Feedback
          {feedbackUnread > 0 && (
            <span style={{
              background: 'var(--accent)', color: '#fff', borderRadius: 999,
              fontSize: 12, fontWeight: 800, padding: '3px 10px',
            }}>
              {feedbackUnread} novo{feedbackUnread === 1 ? '' : 's'}
            </span>
          )}
        </h1>
        <button onClick={onFetchFeedback} style={{
          padding: '8px 14px', background: 'var(--accent-bg)', color: 'var(--accent)', border: 'none',
          borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
        }}>↻ Atualizar</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { key: 'all', label: 'Todos' },
          { key: 'bug', label: '🐛 Bug' },
          { key: 'sugestao', label: '💡 Sugestão' },
          { key: 'elogio', label: '❤️ Elogio' },
          { key: 'outro', label: '💬 Outro' },
        ] as const).map(f => {
          const active = feedbackFilter === f.key;
          return (
            <button key={f.key} onClick={() => setFeedbackFilter(f.key)} style={{
              padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              background: active ? 'var(--accent)' : 'var(--surface)',
              color: active ? '#fff' : '#374151',
              border: active ? '1px solid transparent' : '1px solid var(--border)',
            }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {feedbackLoading ? (
        <p style={{ color: '#6b7280' }}>Carregando…</p>
      ) : filteredFeedback.length === 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r)', padding: 32, textAlign: 'center',
          color: '#6b7280', border: '1px solid var(--border)',
        }}>
          Nenhum feedback {feedbackFilter !== 'all' ? 'nesta categoria' : 'ainda'}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredFeedback.map(f => {
            const meta = FEEDBACK_META[f.category] ?? FEEDBACK_META.outro;
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const isNew = new Date(f.created_at).getTime() >= sevenDaysAgo;
            return (
              <div key={f.id} style={{
                background: 'var(--surface)', borderRadius: 'var(--r)',
                border: '1px solid var(--border)', padding: 16,
                display: 'flex', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--accent-bg)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 16, flexShrink: 0,
                }}>
                  {initial(f.email)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <Chip label={`${meta.emoji} ${meta.label}`} color={meta.color} bg={meta.bg} />
                    {isNew && <Chip label="NOVO" color="#fff" bg="var(--accent)" />}
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                      {f.email ?? 'Usuário removido'}
                    </span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>
                      {fmtDateTime(f.created_at)}
                    </span>
                  </div>
                  <p style={{
                    margin: '4px 0 6px', color: '#111827', fontSize: 14,
                    lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {f.message}
                  </p>
                  {f.page && (
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                      <span style={{ fontWeight: 700, color: '#374151' }}>Página:</span> {f.page}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
