'use client';

import { Target } from 'lucide-react';

// Círculo indigo com 3 ondas concêntricas expandindo em loop.
// Animação CSS pura — escopada via nomes únicos para não colidir com globals.
export default function PulseTarget({ size = 96 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size * 2.2, height: size * 2.2 }}
      aria-hidden
    >
      <span className="pulse-target-wave" style={{ animationDelay: '0s' }} />
      <span className="pulse-target-wave" style={{ animationDelay: '0.6s' }} />
      <span className="pulse-target-wave" style={{ animationDelay: '1.2s' }} />

      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: '#5B5BD6',
          boxShadow: '0 8px 24px rgba(91,91,214,0.35)',
        }}
      >
        <Target size={Math.round(size * 0.45)} color="white" strokeWidth={2.4} />
      </div>

      <style>{`
        .pulse-target-wave {
          position: absolute;
          left: 50%;
          top: 50%;
          width: ${size}px;
          height: ${size}px;
          margin-left: -${size / 2}px;
          margin-top: -${size / 2}px;
          border-radius: 9999px;
          background: rgba(91, 91, 214, 0.28);
          animation: pulseTargetWave 2s ease-out infinite;
        }
        @keyframes pulseTargetWave {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(2); }
        }
      `}</style>
    </div>
  );
}
