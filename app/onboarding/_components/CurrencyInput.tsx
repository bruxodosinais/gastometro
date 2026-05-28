'use client';

import CurrencyInput from '@/components/CurrencyInput';

// Wrapper que preserva a interface string↔string usada pelos steps do onboarding
// (a página armazena strings no formato BR e converte com parseAmount).
// Internamente delega ao CurrencyInput canônico, que trabalha com number.

function strToNumber(str: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

function numberToStr(n: number): string {
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

export function BigCurrencyInput({ value, onChange }: BigCurrencyInputProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <span
        className="text-3xl font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        R$
      </span>
      <div className="relative">
        <CurrencyInput
          value={strToNumber(value)}
          onChange={(n) => onChange(numberToStr(n))}
          placeholder="0,00"
          className="text-6xl font-bold bg-transparent border-none outline-none text-center w-48 pb-2 text-gray-900 placeholder:text-gray-300"
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
