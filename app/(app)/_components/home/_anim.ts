import type { CSSProperties } from 'react';

export function anim(delay: number, duration = 350): CSSProperties {
  return {
    animationName: 'up',
    animationDuration: `${duration}ms`,
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
    animationDelay: `${delay}ms`,
  };
}

export const hidden: CSSProperties = { opacity: 0, transform: 'translateY(12px)' };
