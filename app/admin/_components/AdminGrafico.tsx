import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface GrowthPoint {
  name: string;
  lançamentos: number;
}

interface Props {
  loadingStats: boolean;
  growthData: GrowthPoint[];
}

export function AdminGrafico({ loadingStats, growthData }: Props) {
  return (
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
  );
}
