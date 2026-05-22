'use client';

import { useMemo } from 'react';

const COLORS = ['#5B5BD6', '#00C37A', '#FFB800', '#FF4757', '#4040B0'];

type Props = {
  // Número de partículas. Default 40 — suficiente p/ "celebração" sem
  // pesar o frame em mobile baixo-fim.
  count?: number;
  // Duração da animação de cada partícula (ms). O wrapper desmonta após
  // este tempo, controlado pelo parent.
  durationMs?: number;
};

// Confetti CSS puro (sem canvas). Partículas absolutas em posição random
// no eixo X, caindo com rotação e fade-out. Cada uma com delay próprio
// p/ a chuva parecer contínua dentro da janela de durationMs.
export default function ConfettiAnimation({ count = 40, durationMs = 1500 }: Props) {
  // Memoizado: re-render do parent não deve reembaralhar as partículas
  // (causaria salto visual).
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100;          // %
      const delay = Math.random() * (durationMs * 0.3); // ms (concentra início)
      const drift = (Math.random() - 0.5) * 80;  // px (deriva horizontal)
      const rot = Math.random() * 360;           // deg inicial
      const rotEnd = rot + (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540);
      const size = 6 + Math.random() * 6;        // px
      const color = COLORS[i % COLORS.length];
      const dur = durationMs * (0.7 + Math.random() * 0.3);
      const round = Math.random() < 0.4;
      return { left, delay, drift, rot, rotEnd, size, color, dur, round };
    });
  }, [count, durationMs]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden
    >
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 1.6),
            background: p.color,
            borderRadius: p.round ? '50%' : '2px',
            opacity: 0,
            animation: `confettiFall ${p.dur}ms ${p.delay}ms ease-out forwards`,
            // Variáveis CSS lidas pelo keyframe — evita um keyframe por partícula.
            ['--drift' as string]: `${p.drift}px`,
            ['--rot-start' as string]: `${p.rot}deg`,
            ['--rot-end' as string]: `${p.rotEnd}deg`,
          }}
        />
      ))}

      <style>{`
        @keyframes confettiFall {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(var(--rot-start));
          }
          10% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate3d(var(--drift), 110vh, 0) rotate(var(--rot-end));
          }
        }
      `}</style>
    </div>
  );
}
