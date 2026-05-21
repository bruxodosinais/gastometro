'use client';

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
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
          onFocus={(e) => { if (e.target.value === '0') onChange(''); }}
          placeholder="0"
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
