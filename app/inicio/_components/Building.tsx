'use client';

// Tela de antecipação do funil nativo (Fatia 3): ponte entre o Q8 do quiz e a
// tela "Plano pronto". Mostra uma checklist que aparece em sequência com ✓ e
// auto-avança via onDone após ~2,2s. Sem rota nova, sem libs — só timers com
// cleanup (StrictMode em dev monta/desmonta 2x: o cleanup zera tudo, sem dobrar).

import { useEffect, useRef, useState } from 'react';
import type { PresignupMission } from '@/lib/onboarding/presignupMission';
import { ACCENT, INK, INK_2, INK_3, FONT, QuizShell } from './ui';

const STEP_MS = 600; // intervalo entre cada ✓
const DONE_MS = 2200; // tempo total até o auto-avanço

export default function Building({
  mission,
  onDone,
}: {
  mission: PresignupMission;
  onDone: () => void;
}) {
  const items = ['Analisando sua renda', 'Calculando seu ritmo', `Montando ${mission.name}`];
  const [revealed, setRevealed] = useState(0);

  // onDone num ref → o efeito roda UMA vez (deps []), sem closure velha nem
  // re-disparo se o pai re-renderizar.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    items.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed(i + 1), STEP_MS * (i + 1)));
    });
    timers.push(setTimeout(() => onDoneRef.current(), DONE_MS));
    return () => timers.forEach(clearTimeout); // desmontagem/StrictMode: limpa tudo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QuizShell>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 4 }} aria-hidden="true">
          ⚙️
        </div>
        <h1 style={{ font: `800 24px/1.25 ${FONT}`, color: INK, margin: 0, letterSpacing: '-.4px' }}>
          Montando seu plano…
        </h1>
        <p style={{ font: `500 15px/1.5 ${FONT}`, color: INK_2, margin: '6px 0 22px' }}>
          Personalizando cada detalhe pra você.
        </p>

        <div style={{ display: 'grid', gap: 12, width: '100%', maxWidth: 320 }} aria-live="polite">
          {items.map((label, i) => {
            const on = i < revealed;
            return (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: on ? 1 : 0.4,
                  transition: 'opacity .3s',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 26,
                    height: 26,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: on ? ACCENT : '#E4E4ED',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    font: `900 14px ${FONT}`,
                    transition: 'background .3s',
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <span style={{ font: `700 15px ${FONT}`, color: on ? INK : INK_3, textAlign: 'left' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </QuizShell>
  );
}
