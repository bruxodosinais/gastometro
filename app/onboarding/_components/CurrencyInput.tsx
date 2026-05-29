'use client';

import CurrencyInput from '@/components/CurrencyInput';

// Wrapper que preserva a interface string↔string usada pelos steps do onboarding
// (a página armazena strings no formato BR e converte com parseAmount).
// Internamente delega ao CurrencyInput canônico, que trabalha com number.

export function strToNumber(str: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

export function numberToStr(n: number): string {
  if (!n || n <= 0) return '';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type BigCurrencyInputProps = {
  value: string;
  onChange: (v: string) => void;
};

// Versão inline (campos pequenos): mesma interface string↔string dos steps,
// mas com a máscara BR canônica do CurrencyInput. Substitui os <input> crus que
// deixavam o usuário digitar "1234.56" — que o parseAmount do pai convertia em
// 123456 (erro de 100x). Aqui o valor armazenado é sempre BR canônico (ex.:
// "1.234,56"), que o parseAmount lê corretamente.
type InlineCurrencyInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
};

export function InlineCurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className,
  style,
  'aria-label': ariaLabel,
}: InlineCurrencyInputProps) {
  return (
    <CurrencyInput
      value={strToNumber(value)}
      onChange={(n) => onChange(numberToStr(n))}
      placeholder={placeholder}
      className={className}
      style={style}
      aria-label={ariaLabel}
    />
  );
}

export function BigCurrencyInput({ value, onChange }: BigCurrencyInputProps) {
  // Trata o valor antes de passar ao canônico: 0 ou inválido vira 0 explícito
  // (nunca string vazia), evitando estado residual que exibiria "000,00".
  const numericValue = strToNumber(value);
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <span
        className="text-3xl font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        R$
      </span>
      <div className="relative w-full max-w-[220px]">
        <CurrencyInput
          value={numericValue > 0 ? numericValue : 0}
          onChange={(n) => onChange(n > 0 ? numberToStr(n) : '')}
          placeholder="0,00"
          className="text-5xl font-bold bg-transparent border-none outline-none text-center w-full max-w-[220px] pb-2 text-gray-900 placeholder:text-gray-300"
          style={{ caretColor: 'var(--accent)' }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-100" />
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: 'var(--accent)' }}
        />
      </div>
    </div>
  );
}
