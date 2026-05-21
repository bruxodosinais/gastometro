'use client';

import { formatCurrency } from '@/lib/calculations';
import type { RecurringExpense } from '@/lib/types';
import { OnboardingNav } from './OnboardingNav';

type OnboardingResumoProps = {
  balanceNum: number;
  emergencyNum: number;
  paidThisMonth: number;
  savedIncome: number;
  savedRecurringCount: number;
  savedCardCount: number;
  savedSavings: number;
  salaryDropped: boolean;
  salaryRec: RecurringExpense | null;
  commitError: string | null;
  committing: boolean;
  onBack: () => void;
  onFinish: () => void;
  onSkip: () => void;
};

export function OnboardingResumo({
  balanceNum,
  emergencyNum,
  paidThisMonth,
  savedIncome,
  savedRecurringCount,
  savedCardCount,
  savedSavings,
  salaryDropped,
  salaryRec,
  commitError,
  committing,
  onBack,
  onFinish,
  onSkip,
}: OnboardingResumoProps) {
  const showSummary =
    savedIncome > 0 ||
    savedRecurringCount > 0 ||
    savedCardCount > 0 ||
    savedSavings > 0 ||
    emergencyNum > 0 ||
    (salaryDropped && salaryRec);

  return (
    <div className="flex flex-col items-center text-center gap-0">
      <div
        className="w-16 h-16 rounded-full border-2 flex items-center justify-center text-3xl mb-4"
        style={{
          background: 'var(--accent-bg)',
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
          animation: 'fade-in-scale 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        ✓
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        Tudo configurado!
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        Veja como você começa no TôOrganizado.
      </p>

      <div
        className="w-full rounded-xl px-4 py-4 mb-4 border text-center"
        style={{
          background: 'var(--accent-bg)',
          borderColor: 'var(--accent-soft)',
        }}
      >
        <p className="text-xs text-gray-500">Você começa com</p>
        <p
          className="text-3xl font-bold my-1"
          style={{ color: 'var(--accent)' }}
        >
          {formatCurrency(balanceNum)}
        </p>
        <p className="text-xs text-gray-500">em conta</p>
        {paidThisMonth > 0 && (
          <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-white">
            <span className="font-semibold">
              {formatCurrency(paidThisMonth)}
            </span>{' '}
            já saiu esse mês
          </p>
        )}
      </div>

      {showSummary && (
        <div className="w-full bg-gray-50 rounded-xl px-4 py-4 mb-6 space-y-2.5 text-left">
          {savedIncome > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
              <span>
                Renda de{' '}
                <span className="font-semibold">{formatCurrency(savedIncome)}</span>{' '}
                cadastrada
              </span>
            </div>
          )}
          {savedRecurringCount > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
              <span>
                <span className="font-semibold">{savedRecurringCount}</span>{' '}
                conta{savedRecurringCount > 1 ? 's' : ''} fixa
                {savedRecurringCount > 1 ? 's' : ''} cadastrada
                {savedRecurringCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {savedCardCount > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
              <span>
                <span className="font-semibold">{savedCardCount}</span>{' '}
                cartã{savedCardCount > 1 ? 'ões' : 'o'} cadastrado
                {savedCardCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {savedSavings > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
              <span>
                Meta de{' '}
                <span className="font-semibold">{formatCurrency(savedSavings)}</span>{' '}
                por mês definida
              </span>
            </div>
          )}
          {emergencyNum > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
              <span>
                Reserva de{' '}
                <span className="font-semibold">
                  {formatCurrency(emergencyNum)}
                </span>{' '}
                registrada
              </span>
            </div>
          )}
          {salaryDropped && salaryRec && (
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
              <span>Salário deste mês marcado como recebido</span>
            </div>
          )}
        </div>
      )}

      {commitError && (
        <div
          role="alert"
          className="mt-4 mb-2 text-xs leading-relaxed text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5"
        >
          {commitError}{' '}
          <span className="font-medium">Clique de novo para continuar mesmo assim.</span>
        </div>
      )}
      <OnboardingNav
        onBack={onBack}
        onPrimary={onFinish}
        primaryLabel={commitError ? 'Continuar mesmo assim' : 'Começar organizado'}
        loading={committing}
        onSkip={onSkip}
        skipLabel="Pular por agora"
      />
    </div>
  );
}
