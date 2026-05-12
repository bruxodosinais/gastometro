export const metadata = { title: 'Admin — TôOrganizado' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>{children}</div>;
}
