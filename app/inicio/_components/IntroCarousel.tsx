'use client';

// Carousel de boas-vindas (3 slides) do onboarding nativo. Extraído de
// app/inicio/page.tsx na Fatia 2. Os CTAs agora delegam ao orquestrador via
// props: "Começar grátis" → onStart (entra no quiz, SEM marcar intro vista);
// "Já tenho conta" → onLogin (marca intro vista + vai pro login). Assim, quem
// abandona o quiz revê o carousel no relaunch em vez de cair direto no login.

import { useRef, useState } from 'react';
import { ACCENT, ACCENT_DARK, BG, INK, INK_2, FONT } from './ui';

type Slide = { emoji: string; title: string; body: string };

const SLIDES: Slide[] = [
  {
    emoji: '💰',
    title: 'Saiba pra onde vai seu dinheiro',
    body: 'Enxergue pra onde seu dinheiro vai e comece a guardar todo mês.',
  },
  {
    emoji: '🎯',
    title: 'Bata metas com a Missão de Poupança',
    body: 'Defina um objetivo, faça aportes e veja sua reserva crescer — como um jogo.',
  },
  {
    emoji: '🔥',
    title: 'Mantenha a sequência',
    body: 'Registre todo dia, ganhe streaks, badges e suba de nível. Vira hábito.',
  },
];

const LAST = SLIDES.length - 1;

export default function IntroCarousel({
  onStart,
  onLogin,
}: {
  onStart: () => void;
  onLogin: () => void;
}) {
  const [index, setIndex] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const dragDX = useRef(0);
  const [drag, setDrag] = useState(0);

  function goTo(i: number) {
    setIndex(Math.max(0, Math.min(LAST, i)));
  }

  function onPointerDown(e: React.PointerEvent) {
    dragStartX.current = e.clientX;
    dragDX.current = 0;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStartX.current === null) return;
    let dx = e.clientX - dragStartX.current;
    if ((index === 0 && dx > 0) || (index === LAST && dx < 0)) dx *= 0.35;
    dragDX.current = dx;
    setDrag(dx);
  }
  function onPointerUp() {
    if (dragStartX.current === null) return;
    const dx = dragDX.current;
    const threshold = 56;
    if (dx <= -threshold) goTo(index + 1);
    else if (dx >= threshold) goTo(index - 1);
    dragStartX.current = null;
    dragDX.current = 0;
    setDrag(0);
  }

  const onLast = index === LAST;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: BG,
        color: INK,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        overflow: 'hidden',
        touchAction: 'pan-y',
      }}
    >
      {/* Topo: dots + Pular */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 22px 8px',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }} aria-hidden="true">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 4,
                background: i === index ? ACCENT : '#D9D9E4',
                transition: 'width .25s ease, background .25s ease',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(LAST)}
          style={{
            visibility: onLast ? 'hidden' : 'visible',
            border: 'none',
            background: 'transparent',
            color: INK_2,
            font: `700 15px ${FONT}`,
            cursor: 'pointer',
            padding: '6px 4px',
          }}
        >
          Pular
        </button>
      </div>

      {/* Track */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          style={{
            display: 'flex',
            height: '100%',
            width: `${SLIDES.length * 100}%`,
            transform: `translateX(calc(${(-index * 100) / SLIDES.length}% + ${drag}px))`,
            transition: dragStartX.current === null ? 'transform .32s cubic-bezier(.22,.61,.36,1)' : 'none',
          }}
        >
          {SLIDES.map((s, i) => (
            <section
              key={i}
              aria-hidden={i !== index}
              style={{
                width: `${100 / SLIDES.length}%`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '0 32px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: 32,
                  background: '#fff',
                  boxShadow: '0 12px 32px rgba(91,91,214,.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 64,
                  marginBottom: 36,
                }}
              >
                <span aria-hidden="true">{s.emoji}</span>
              </div>
              <h1
                style={{
                  font: `800 26px/1.25 ${FONT}`,
                  color: INK,
                  margin: '0 0 14px',
                  letterSpacing: '-.4px',
                  maxWidth: 320,
                }}
              >
                {s.title}
              </h1>
              <p style={{ font: `500 16px/1.5 ${FONT}`, color: INK_2, margin: 0, maxWidth: 300 }}>
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </div>

      {/* Rodapé: avançar (slides 1-2) ou CTAs (slide final) */}
      <div style={{ padding: '0 24px 28px', minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {onLast ? (
          <>
            <button
              type="button"
              onClick={onStart}
              style={{
                height: 54,
                borderRadius: 16,
                border: 'none',
                background: ACCENT,
                color: '#fff',
                font: `800 17px ${FONT}`,
                boxShadow: '0 8px 20px rgba(91,91,214,.40)',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Começar grátis
            </button>
            <button
              type="button"
              onClick={onLogin}
              style={{
                marginTop: 14,
                height: 44,
                border: 'none',
                background: 'transparent',
                color: ACCENT_DARK,
                font: `700 15px ${FONT}`,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Já tenho conta — Entrar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Avançar"
            style={{
              alignSelf: 'center',
              width: 60,
              height: 60,
              borderRadius: '50%',
              border: 'none',
              background: ACCENT,
              color: '#fff',
              boxShadow: '0 8px 20px rgba(91,91,214,.40)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
