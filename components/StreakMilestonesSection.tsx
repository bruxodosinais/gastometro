'use client';

import { MILESTONE_DEFS } from '@/lib/gamification/milestones';
import { useStreakMilestones } from '@/lib/gamification/useStreakMilestones';

// Seção de badges de marcos de ofensiva (perfil). Desbloqueados em dourado,
// bloqueados em cinza. Self-fetch via useStreakMilestones. Item 4a NÃO promete
// Pro — só o badge/recompensa em moedas; o Pro de 30/365 vem no 4b.
export default function StreakMilestonesSection() {
  const { unlocked } = useStreakMilestones();
  const unlockedSet = new Set(unlocked);

  return (
    <div style={{ marginBottom: 12 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '0 2px',
          marginBottom: 8,
          display: 'block',
        }}
      >
        Marcos de ofensiva
      </span>
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
        }}
      >
        {MILESTONE_DEFS.map((def) => {
          const isUnlocked = unlockedSet.has(def.days);
          return (
            <div
              key={def.days}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isUnlocked ? '#FFF3D6' : 'var(--border-2)',
                  border: `2px solid ${isUnlocked ? '#FFB800' : 'var(--border)'}`,
                  color: isUnlocked ? '#9A6400' : 'var(--text-3)',
                  opacity: isUnlocked ? 1 : 0.6,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{def.days}</span>
                <span style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, marginTop: 1 }}>
                  {def.days === 1 ? 'dia' : 'dias'}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: isUnlocked ? 'var(--text)' : 'var(--text-3)',
                  lineHeight: 1.2,
                }}
              >
                {def.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
