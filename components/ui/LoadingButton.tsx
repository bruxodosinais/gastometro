'use client';

import React from 'react';

function Spinner({ size, color }: { size: number; color: string }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** When true: button is disabled, opacity is reduced and a spinner is shown. */
  loading?: boolean;
  /** Optional text rendered next to the spinner while loading. If omitted, only the spinner is shown. */
  loadingText?: React.ReactNode;
  /** Spinner diameter in px. Defaults to 16 (small). */
  spinnerSize?: number;
  /** Spinner stroke color. Defaults to white. */
  spinnerColor?: string;
}

/**
 * Botão de ação primária com feedback de carregamento.
 *
 * Encapsula apenas o ESTADO VISUAL (disabled + opacidade + spinner) — toda a
 * lógica de negócio (onClick/onSubmit, validações) continua no chamador.
 * Repassa `style`, `className` e demais props nativas para preservar as cores
 * e estilos já existentes em cada tela.
 */
export default function LoadingButton({
  loading = false,
  loadingText,
  spinnerSize = 16,
  spinnerColor = '#ffffff',
  disabled,
  children,
  style,
  ...rest
}: LoadingButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        ...style,
        ...(loading ? { opacity: 0.7, cursor: 'not-allowed' } : null),
      }}
    >
      {loading ? (
        <>
          <Spinner size={spinnerSize} color={spinnerColor} />
          {loadingText ?? null}
        </>
      ) : (
        children
      )}
    </button>
  );
}
