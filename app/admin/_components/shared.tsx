import { pct } from './utils';

export function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r)', padding: '20px 20px 16px',
      border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = pct(value, total);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: '#374151' }}>{label}</span>
        <span style={{ fontWeight: 700, color: '#111827' }}>{value} <span style={{ color: '#6b7280', fontWeight: 400 }}>({p}%)</span></span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 4, height: 8 }}>
        <div style={{ width: `${p}%`, background: color, borderRadius: 4, height: 8, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

export function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
      {label}
    </span>
  );
}

export function PlanBadge({ plan, billingCycle }: { plan: string; billingCycle: string | null }) {
  if (plan === 'pro' && billingCycle === 'beta') {
    return <Chip label="BETA" color="#ffffff" bg="#6366F1" />;
  }
  if (plan === 'pro' && billingCycle === 'manual') {
    return <Chip label="PRO manual" color="#7a5d00" bg="#FFF4CC" />;
  }
  if (plan === 'pro') {
    return <Chip label="PRO Kiwify" color="#3730a3" bg="#E0E7FF" />;
  }
  return <Chip label="FREE" color="#4b5563" bg="#E5E7EB" />;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '32px 0 16px' }}>
      {children}
    </h2>
  );
}

export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid var(--border-2)', paddingBottom: 8 }}>
      <span style={{ color: '#374151' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#111827' }}>{value}</span>
    </div>
  );
}
