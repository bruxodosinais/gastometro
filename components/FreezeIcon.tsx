import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// Floco de gelo (Streak Freeze) em SVG inline — fonte única do ícone 🧊, pelo
// mesmo motivo do CoinIcon: emoji renderiza diferente por sistema. Azul-gelo
// fixo (#38A8D8), nítido em light e dark. `size` controla largura/altura
// (default 16). display:block evita gap de baseline em flex.
export default function FreezeIcon({ size = 16, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="#38A8D8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 3 eixos do floco */}
        <path d="M12 2.5v19" />
        <path d="M3.77 7.25 20.23 16.75" />
        <path d="M20.23 7.25 3.77 16.75" />
        {/* ramos das pontas verticais */}
        <path d="M12 6.2 9.7 4.4M12 6.2 14.3 4.4" />
        <path d="M12 17.8 9.7 19.6M12 17.8 14.3 19.6" />
        {/* ramos das pontas diagonais */}
        <path d="M6.9 9.2 4.1 9.0M6.9 9.2 6.6 12.0" />
        <path d="M17.1 14.8 19.9 15.0M17.1 14.8 17.4 12.0" />
        <path d="M17.1 9.2 19.9 9.0M17.1 9.2 17.4 12.0" />
        <path d="M6.9 14.8 4.1 15.0M6.9 14.8 6.6 12.0" />
      </g>
    </svg>
  );
}
