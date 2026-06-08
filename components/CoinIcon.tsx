import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// Moeda dourada em SVG inline — fonte ÚNICA do ícone de moedas (badge da Home
// e CoinToast). Substitui o emoji 🪙, que renderiza prateado/escuro ("lua") em
// vários sistemas. Cores fixas (não currentColor) para o dourado ser
// consistente em light e dark mode. `size` controla largura/altura (default 16,
// cabe no badge e no toast). display:block evita o gap de baseline em flex.
export default function CoinIcon({ size = 16, className, style }: Props) {
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
      {/* disco dourado + borda mais escura (profundidade) */}
      <circle cx="12" cy="12" r="10.5" fill="#FFC83D" stroke="#E0A000" strokeWidth="1.5" />
      {/* anel interno: leve relevo */}
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#E0A000" strokeWidth="1" strokeOpacity="0.45" />
      {/* brilho sutil no canto superior esquerdo */}
      <circle cx="8.5" cy="8.5" r="2.2" fill="#FFE08A" fillOpacity="0.9" />
      {/* cifrão central */}
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#9A6400"
      >
        $
      </text>
    </svg>
  );
}
