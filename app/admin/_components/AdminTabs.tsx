import { NAV_TABS, type TabKey } from './types';

interface Props {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  feedbackUnread: number;
}

export function AdminTabs({ tab, setTab, feedbackUnread }: Props) {
  return (
    <div className="admin-mobile-tabs" style={{ display: 'none', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
      {NAV_TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
          background: tab === t.key ? 'var(--accent)' : 'var(--surface)',
          color: tab === t.key ? '#fff' : '#374151',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span>{t.label}</span>
          {t.key === 'feedback' && feedbackUnread > 0 && (
            <span style={{
              background: tab === t.key ? 'rgba(255,255,255,0.25)' : 'var(--accent)',
              color: '#fff', borderRadius: 999,
              fontSize: 11, fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center',
            }}>
              {feedbackUnread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
