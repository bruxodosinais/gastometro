'use client';

import { formatCurrency } from '@/lib/calculations';
import { BigCurrencyInput } from './CurrencyInput';
import { OnboardingNav } from './OnboardingNav';
import { OnboardingProgress } from './OnboardingProgress';

function numToStr(n: number): string {
  if (!n) return '';
  return n.toFixed(0);
}

type OnboardingStep4MetaProps = {
  totalSteps: number;
  savings: string;
  setSavings: (v: string) => void;
  savingsNum: number;
  savedIncome: number;
  saving: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function OnboardingStep4Meta({
  totalSteps,
  savings,
  setSavings,
  savingsNum,
  savedIncome,
  saving,
  onBack,
  onContinue,
  onSkip,
}: OnboardingStep4MetaProps) {
  const savingsMax = savedIncome > 0 ? savedIncome * 0.5 : 5000;
  const savingsPct = savingsMax > 0 ? (savingsNum / savingsMax) * 100 : 0;

  return (
    <div className="flex flex-col gap-0">
      <OnboardingProgress
        filled={4}
        totalSteps={totalSteps}
        label={`Passo 4 de ${totalSteps}`}
      />
      <h2 className="text-xl font-bold text-gray-900 text-center">
        Quanto quer guardar por mês?
      </h2>
      <p className="text-sm text-gray-400 text-center mt-1 mb-4">
        Sua meta de poupança mensal.
      </p>

      {savedIncome > 0 && (
        <div
          className="rounded-xl px-4 py-3 mb-4 border"
          style={{
            background: 'var(--accent-bg)',
            borderColor: 'var(--accent-soft)',
          }}
        >
          <p
            className="text-xs text-center leading-relaxed"
            style={{ color: 'var(--accent)' }}
          >
            Com{' '}
            <span className="font-semibold">{formatCurrency(savedIncome)}</span>,
            guardar{' '}
            <span className="font-semibold">
              {formatCurrency(savedIncome * 0.2)}
            </span>{' '}
            representa 20% — uma boa referência.
          </p>
        </div>
      )}

      <BigCurrencyInput value={savings} onChange={setSavings} />

      <div className="mt-4 px-1">
        <input
          type="range"
          min={0}
          max={savingsMax}
          step={savingsMax > 1000 ? 50 : 10}
          value={savingsNum}
          onChange={(e) => setSavings(numToStr(Number(e.target.value)))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--accent) ${savingsPct}%, #e5e7eb ${savingsPct}%)`,
            accentColor: '#5B5BD6',
          }}
        />
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>R$ 0</span>
          <span>{formatCurrency(savingsMax)}</span>
        </div>
      </div>

      <div className="h-8" />
      <OnboardingNav
        onBack={onBack}
        onPrimary={onContinue}
        primaryLabel="Continuar"
        loading={saving}
        onSkip={onSkip}
      />
    </div>
  );
}
