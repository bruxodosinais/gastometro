'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCachedUser, invalidate } from '@/lib/dataCache';
import { ROUNDUP_MULTIPLES } from '@/lib/mission/roundup';

// Preferências do Round-up (M5). Self-fetch: lê/escreve profiles.roundup_enabled
// e roundup_multiple. Funciona quando há uma Missão ativa (aviso no rodapé).
export default function RoundUpSettings() {
  const [enabled, setEnabled] = useState(false);
  const [multiple, setMultiple] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCachedUser();
      if (!user) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data } = await createClient()
        .from('profiles')
        .select('roundup_enabled, roundup_multiple')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setEnabled((data?.roundup_enabled as boolean | null) ?? false);
      setMultiple((data?.roundup_multiple as number | null) ?? 1);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(patch: { roundup_enabled?: boolean; roundup_multiple?: number }) {
    if (saving) return;
    setSaving(true);
    try {
      const user = await getCachedUser();
      if (!user) return;
      await createClient().from('profiles').upsert({ id: user.id, ...patch });
      invalidate('profile');
    } finally {
      setSaving(false);
    }
  }

  function toggle() {
    const next = !enabled;
    setEnabled(next); // otimista
    persist({ roundup_enabled: next });
  }

  function pickMultiple(m: number) {
    setMultiple(m); // otimista
    persist({ roundup_multiple: m });
  }

  if (!loaded) return null;

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
        Micro-aporte
      </span>
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            borderBottom: enabled ? '1px solid var(--border-2)' : 'none',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Arredondar gastos e guardar a diferença
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0', lineHeight: 1.4 }}>
              Cada gasto é arredondado pra cima e a diferença vai pra sua Missão ativa.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={toggle}
            style={{
              position: 'relative',
              width: 44,
              height: 24,
              borderRadius: 12,
              background: enabled ? 'var(--accent)' : 'var(--border)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 200ms',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: enabled ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 200ms',
              }}
            />
          </button>
        </div>

        {enabled && (
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', margin: '0 0 8px' }}>
              Arredondar para o próximo
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {ROUNDUP_MULTIPLES.map((m) => {
                const active = multiple === m;
                return (
                  <button
                    key={m}
                    onClick={() => pickMultiple(m)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 'var(--r-sm)',
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent)' : 'var(--bg)',
                      color: active ? '#fff' : 'var(--text-2)',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    R$ {m}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '10px 0 0', lineHeight: 1.4 }}>
              Funciona quando você tem uma Missão de Poupança ativa. O micro-aporte avança a meta,
              mas não rende moedas (essas só pelo aporte manual).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
