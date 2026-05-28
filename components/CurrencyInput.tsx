'use client';

import { useEffect, useState } from 'react';

interface CurrencyInputProps {
  value: number; // valor atual em float (reais)
  onChange: (value: number) => void;
  placeholder?: string; // padrão: "0,00"
  className?: string;
  style?: React.CSSProperties; // herda estilos grandes de lancamentos/recorrentes
  autoFocus?: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onFocus?: () => void;
  onBlur?: () => void;
  'aria-label'?: string;
}

const MAX_DIGITS = 15; // teto de segurança (até ~9.999.999.999.999,99)

// "150000" -> "1.500,00" | "1" -> "0,01" | "" -> ""
function formatDigits(digits: string): string {
  if (!digits) return '';
  const padded = digits.padStart(3, '0'); // garante ao menos "0,0X"
  const cents = padded.slice(-2);
  const intPart = padded.slice(0, -2);
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${cents}`;
}

function numberToDigits(value: number): string {
  if (!value || value <= 0 || !Number.isFinite(value)) return '';
  return String(Math.round(value * 100));
}

function digitsToNumber(digits: string): number {
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className,
  style,
  autoFocus,
  disabled,
  inputRef,
  onFocus,
  onBlur,
  'aria-label': ariaLabel,
}: CurrencyInputProps) {
  // Estado interno: dígitos brutos (centavos), ex: "150000"
  const [digits, setDigits] = useState<string>(() => numberToDigits(value));

  // Sincroniza com mudanças externas de `value` (ex: limpar form, editar item).
  // Compara em centavos inteiros para não brigar com a própria digitação.
  useEffect(() => {
    const externalCents = Math.round((value || 0) * 100);
    const internalCents = digits ? parseInt(digits, 10) : 0;
    if (externalCents !== internalCents) {
      setDigits(externalCents > 0 ? String(externalCents) : '');
    }
    // Intencionalmente só reage a `value`; `digits` está sempre commitado aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Extrai apenas dígitos do valor exibido (formatado). Isso cobre digitação,
    // backspace, colar e teclados mobile (keyCode 229) de forma robusta.
    const raw = e.target.value
      .replace(/\D/g, '')
      .replace(/^0+/, '')
      .slice(0, MAX_DIGITS);
    setDigits(raw);
    onChange(digitsToNumber(raw));
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={formatDigits(digits)}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
      style={style}
      autoFocus={autoFocus}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
}
