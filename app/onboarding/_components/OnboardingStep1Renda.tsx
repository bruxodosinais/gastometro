'use client';

import { BigCurrencyInput } from './CurrencyInput';
import { OnboardingNav } from './OnboardingNav';
import { OnboardingProgress } from './OnboardingProgress';

type OnboardingStep1RendaProps = {
  totalSteps: number;
  income: string;
  setIncome: (v: string) => void;
  incomeDay: string;
  setIncomeDay: (v: string) => void;
  incomeNum: number;
  saving: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function OnboardingStep1Renda({
  totalSteps,
  income,
  setIncome,
  incomeDay,
  setIncomeDay,
  incomeNum,
  saving,
  onBack,
  onContinue,
  onSkip,
}: OnboardingStep1RendaProps) {
  return (
    <div className="flex flex-col gap-0">
      <OnboardingProgress
        filled={1}
        totalSteps={totalSteps}
        label={`Passo 1 de ${totalSteps}`}
      />
      <h2 className="text-xl font-bold text-gray-900 text-center">
        Qual é sua renda mensal?
      </h2>
      <p className="text-sm text-gray-400 text-center mt-1 mb-8">
        Pode ser salário, aposentadoria ou qualquer entrada fixa mensal.
      </p>
      <BigCurrencyInput value={income} onChange={setIncome} />
      <div className="h-4" />
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-gray-400">Recebo todo dia</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={incomeDay}
          onChange={(e) => setIncomeDay(e.target.value)}
          placeholder="1"
          className="w-16 text-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors"
          style={{ caretColor: 'var(--accent)' }}
        />
        <span className="text-sm text-gray-400">do mês</span>
      </div>
      <div className="h-6" />
      <OnboardingNav
        onBack={onBack}
        onPrimary={onContinue}
        primaryLabel="Continuar"
        primaryDisabled={incomeNum <= 0}
        loading={saving}
        onSkip={onSkip}
      />
    </div>
  );
}
